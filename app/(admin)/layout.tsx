import Link from "next/link";
import { LayoutGrid, LogOut, MessageSquare } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NavLinks } from "@/components/admin/nav-links";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/chat" className="sidebar-brand">
          <span className="sidebar-brand-mark"><LayoutGrid size={15} /></span>
          <span>
            <span className="sidebar-brand-name" style={{ display: "block" }}>Lysdals</span>
            <span className="sidebar-brand-sub">Redaktion</span>
          </span>
        </Link>
        <NavLinks />
        <div className="sidebar-spacer" />
        <div className="sidebar-bottom">
          <Link href="/chat" className="sidebar-cta"><MessageSquare size={16} /> AI Assistent</Link>
          <div className="sidebar-user">
            <strong>{session.user.name}</strong>
            <small>{session.user.roleName}</small>
          </div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button className="sidebar-logout" type="submit"><LogOut size={16} /> Log ud</button>
          </form>
        </div>
      </aside>
      <div className="app-content">{children}</div>
    </div>
  );
}
