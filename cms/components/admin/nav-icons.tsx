import {
  Activity, Antenna, BarChart3, ClipboardList, FileText, FolderTree, Handshake, Images, Inbox, LayoutTemplate, Mail, MapPin,
  Megaphone, MessageSquareText, Mic, PenLine, Radio, Rss, Tags, UserRound, Users, WalletCards, CircleHelp,
  KeyRound, ScrollText, ShieldCheck, SlidersHorizontal, Workflow, type LucideIcon,
} from "lucide-react";
import type { NavIconKey } from "./nav-model";

/** Ét ikon pr. punkt (ingen dubletter): nøglerne er defineret i nav-model.ts. */
export const NAV_ICONS: Record<NavIconKey, LucideIcon> = {
  engine: Workflow,
  control: SlidersHorizontal,
  prompts: ScrollText,
  ratings: ShieldCheck,
  feeds: Antenna,
  ingest: KeyRound,
  articles: FileText,
  write: PenLine,
  media: Images,
  tasks: ClipboardList,
  fee: WalletCards,
  chat: MessageSquareText,
  inbox: Inbox,
  qa: CircleHelp,
  signals: Rss,
  sources: Radio,
  interview: Mic,
  analytics: BarChart3,
  newsletter: Mail,
  ads: Megaphone,
  sponsor: Handshake,
  sections: FolderTree,
  areas: MapPin,
  topics: Tags,
  frontpage: LayoutTemplate,
  users: Users,
  operator: Activity,
  account: UserRound,
};
