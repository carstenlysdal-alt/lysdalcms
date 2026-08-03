import { FileText, Music, Video } from "lucide-react";

export function MediaPreview({ media, detail = false }: { media: { filtype: string; url: string; altTekst: string | null; filnavn: string | null }; detail?: boolean }) {
  if (media.filtype === "billede") return (
    // Media hosts are configured dynamically per CMS instance.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`media-image grayscale ${detail ? "media-image-detail" : ""}`} src={media.url} alt={media.altTekst ?? ""} />
  );
  if (media.filtype === "video") return detail ? <video className="media-player" src={media.url} controls /> : <span className="media-placeholder"><Video size={32} /><small>Video</small></span>;
  if (media.filtype === "lyd") return detail ? <audio className="media-audio" src={media.url} controls /> : <span className="media-placeholder"><Music size={32} /><small>Lyd</small></span>;
  return <span className="media-placeholder"><FileText size={32} /><small>{media.filnavn ?? "Dokument"}</small></span>;
}
