import "next-auth";

declare module "next-auth" {
  interface User {
    roleId: string;
    roleName: string;
    instansId: string;
    authorId: string | null;
    permissions: string[];
  }

  interface Session {
    user: User;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roleId?: string;
    roleName?: string;
    instansId?: string;
    authorId?: string | null;
    permissions?: string[];
  }
}
