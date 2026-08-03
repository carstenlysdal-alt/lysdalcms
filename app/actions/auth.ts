"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export type LoginState = { error?: string };

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: typeof formData.get("callbackUrl") === "string" ? formData.get("callbackUrl") as string : "/artikler",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) return { error: "E-mail eller adgangskode er forkert." };
    throw error;
  }
}
