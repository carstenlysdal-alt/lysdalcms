import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChatInterface } from "./chat-interface";
import { randomUUID } from "crypto";

export default async function ChatPage({ searchParams }: PageProps<"/chat">) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const sessionId = typeof params.session === "string" ? params.session : randomUUID();

  const history = await db.chatMessage.findMany({
    where: { sessionId, instansId: session.user.instansId },
    orderBy: { createdAt: "asc" },
    take: 40,
  });

  return (
    <main className="admin-main chat-page">
      <ChatInterface
        sessionId={sessionId}
        initialMessages={history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))}
      />
    </main>
  );
}
