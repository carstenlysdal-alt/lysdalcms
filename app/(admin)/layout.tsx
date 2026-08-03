import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, LogOut, Settings } from "lucide-react";
import { auth, signOut } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div className="admin-shell">
      <header className="nav">
        <Link className="nav-brand" href="/artikler">LYSDALS / CMS</Link>
        <nav className="admin-links" aria-label="Primær navigation">
          <Link href="/artikler"><FileText size={16} /> Artikler</Link>
          <span className="nav-disabled"><Settings size={16} /> Indstillinger</span>
        </nav>
        <div className="nav-user">
          <span><strong>{session.user.name}</strong><small>{session.user.roleName}</small></span>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button className="btn btn-icon btn-ghost" aria-label="Log ud"><LogOut size={18} /></button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
