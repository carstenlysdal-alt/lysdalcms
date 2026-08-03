import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MediaCreateForm } from "@/components/media/media-create-form";
import { auth } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";

export default async function NewMediaPage() {
  const session = await auth();
  if (!session?.user) return null;
  if (!can(session.user, PERMISSIONS.MEDIA_MANAGE)) return <main className="admin-main"><div className="dialog inline-dialog"><h1 className="dialog-title">Ingen adgang</h1><p className="dialog-body">Din rolle kan se og genbruge medier, men ikke tilføje nye.</p><Link className="btn btn-secondary" href="/medier">Til biblioteket</Link></div></main>;
  return <main className="admin-main narrow-page"><Link className="btn btn-ghost" href="/medier"><ChevronLeft size={16} /> Mediebibliotek</Link><div className="page-heading"><div><span className="eyebrow">CMS-03</span><h1>Tilføj medie</h1><p className="text-muted">Upload en fil eller registrér et eksternt medie.</p></div></div><MediaCreateForm /></main>;
}
