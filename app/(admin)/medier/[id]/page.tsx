import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { MediaEditForm } from "@/components/media/media-edit-form";
import { MediaPreview } from "@/components/media/media-preview";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";

export default async function MediaDetailPage({ params }: PageProps<"/medier/[id]">) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  const media = await db.media.findFirst({ where: { id, instansId: session.user.instansId } });
  if (!media) notFound();
  return <main className="admin-main"><Link className="btn btn-ghost" href="/medier"><ChevronLeft size={16} /> Mediebibliotek</Link><div className="page-heading"><div><span className="eyebrow">{media.filtype} · {media.kildeType}</span><h1>{media.billedtekst || media.filnavn || "Medie"}</h1><a href={media.url} target="_blank" rel="noreferrer">Åbn original <ExternalLink size={13} /></a></div></div><div className="media-detail-grid"><div className="media-detail-preview"><MediaPreview media={media} detail /><dl className="media-facts"><div><dt>Filnavn</dt><dd>{media.filnavn || "—"}</dd></div><div><dt>Format</dt><dd>{media.mimeType || media.filtype}</dd></div><div><dt>Dimensioner</dt><dd>{media.bredde && media.hoejde ? `${media.bredde} × ${media.hoejde}` : "—"}</dd></div><div><dt>Oprettet</dt><dd>{new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(media.createdAt)}</dd></div></dl></div>{can(session.user, PERMISSIONS.MEDIA_MANAGE) ? <MediaEditForm media={media} /> : <div className="card"><p>Du kan se og genbruge mediet, men din rolle kan ikke redigere metadata.</p></div>}</div></main>;
}
