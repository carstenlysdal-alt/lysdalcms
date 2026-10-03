"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { NAV_ICONS } from "./nav-icons";
import { useShell } from "./shell-frame";
import type { NavItem } from "./nav-model";

/** Bundnavigation på mobil (≤ 900 px): fire hovedpunkter + "Mere" (åbner hele menuen som drawer). */
export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const { openDrawer, drawerOpen } = useShell();
  return (
    <nav className="shell-bottomnav" aria-label="Hurtig navigation" data-shell-inert>
      <ul>
        {items.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const isActive = path === item.href || path.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link href={item.href} className="shell-bottom-link" aria-current={isActive ? "page" : undefined}>
                <span className="shell-bottom-icon">
                  <Icon size={20} aria-hidden="true" />
                  {item.badge ? <span className="shell-bottom-badge" aria-hidden="true">{item.badge > 9 ? "9+" : item.badge}</span> : null}
                </span>
                <span>{item.shortLabel ?? item.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button type="button" className="shell-bottom-link" onClick={openDrawer} aria-expanded={drawerOpen} aria-controls="shell-sidebar">
            <span className="shell-bottom-icon"><Menu size={20} aria-hidden="true" /></span>
            <span>Mere</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
