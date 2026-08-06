import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if ((await auth())?.user) redirect("/chat");
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" && params.callbackUrl.startsWith("/") ? params.callbackUrl : "/chat";
  return <main className="login-page"><LoginForm callbackUrl={callbackUrl} /></main>;
}
