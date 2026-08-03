import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const client = new Anthropic();

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { sessionId, message, mode } = await req.json() as {
    sessionId: string;
    message: string;
    mode: "ask" | "auto";
  };

  // Hent samtalehistorik
  const history = await db.chatMessage.findMany({
    where: { sessionId, instansId: session.user.instansId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  // Gem brugerbesked
  await db.chatMessage.create({
    data: {
      sessionId,
      role: "user",
      content: message,
      instansId: session.user.instansId,
      userId: session.user.id,
    },
  });

  const systemPrompt = mode === "auto"
    ? `Du er en redaktionel AI-assistent for ${session.user.name ?? "redaktøren"}. Du hjælper med at skrive, undersøge og redigere journalistiske historier. Brug en professionel, dansk journalistisk tone. Svar kortfattet og præcist.`
    : `Du er en research-assistent for ${session.user.name ?? "redaktøren"}. Du undersøger påstande, finder vinkler og identificerer kilder. Svar på dansk med fakta og nuancer.`;

  const messages = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();
  let fullContent = "";

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          const text = chunk.delta.text;
          fullContent += text;
          controller.enqueue(encoder.encode(text));
        }
      }
      // Gem AI-svar
      await db.chatMessage.create({
        data: {
          sessionId,
          role: "assistant",
          content: fullContent,
          instansId: session.user.instansId,
        },
      });
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });
}
