import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "./db";

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Adgangskode", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          include: { role: true },
        });
        if (!user || !(await compare(parsed.data.password, user.passwordHash))) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.navn,
          roleId: user.roleId,
          roleName: user.role.navn,
          instansId: user.instansId,
          authorId: user.authorId,
          permissions: Array.isArray(user.role.permissions) ? user.role.permissions as string[] : [],
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.instansId = user.instansId;
        token.authorId = user.authorId;
        token.permissions = user.permissions;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.roleId = token.roleId as string;
        session.user.roleName = token.roleName as string;
        session.user.instansId = token.instansId as string;
        session.user.authorId = token.authorId as string | null;
        session.user.permissions = (token.permissions as string[]) ?? [];
      }
      return session;
    },
  },
});
