"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, Calendar, FileText, Images, Radio, Rss, WalletCards } from "lucide-react";

const links = [
  { href: "/artikler", label: "Artikler", icon: FileText },
  { href: "/signaler", label: "Signaler", icon: Rss },
  { href: "/emner", label: "Emner", icon: Radio },
  { href: "/medier", label: "Medier", icon: Images },
  { href: "/opgaver", label: "Opgaver", icon: BriefcaseBusiness },
  { href: "/honorar", label: "Honorar", icon: WalletCards },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="sidebar-nav" aria-label="Primær navigation">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="sidebar-link"
          aria-current={path.startsWith(href) ? "page" : undefined}
        >
          <Icon size={16} /> {label}
        </Link>
      ))}
      <span className="sidebar-link sidebar-link-disabled" aria-disabled="true">
        <Calendar size={16} /> Kalender <span className="sidebar-link-badge">Snart</span>
      </span>
    </nav>
  );
}
