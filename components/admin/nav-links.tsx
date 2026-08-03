"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, FileText, Images, WalletCards } from "lucide-react";

const links = [
  { href: "/artikler", label: "Artikler", icon: FileText },
  { href: "/medier", label: "Medier", icon: Images },
  { href: "/opgaver", label: "Opgaver", icon: BriefcaseBusiness },
  { href: "/honorar", label: "Honorar", icon: WalletCards },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="admin-links" aria-label="Primær navigation">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={path.startsWith(href) ? "page" : undefined}
        >
          <Icon size={16} /> {label}
        </Link>
      ))}
    </nav>
  );
}
