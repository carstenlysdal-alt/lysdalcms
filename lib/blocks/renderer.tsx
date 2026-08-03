import type { Block } from "./schema";

export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <div className="article-blocks">
      {blocks.map((block) => {
        switch (block.type) {
          case "paragraph": return <div key={block.id} dangerouslySetInnerHTML={{ __html: block.data.content }} />;
          case "heading": return block.data.level === 2 ? <h2 key={block.id}>{block.data.text}</h2> : <h3 key={block.id}>{block.data.text}</h3>;
          case "subheading": return <h3 key={block.id}>{block.data.text}</h3>;
          case "manchet": return <p className="article-manchet" key={block.id}>{block.data.text}</p>;
          case "quote": return <blockquote key={block.id}><p>{block.data.quote}</p>{block.data.attribution && <cite>{block.data.attribution}</cite>}</blockquote>;
          case "factbox": return <aside className="article-box" key={block.id}><strong>{block.data.title}</strong><p>{block.data.content}</p></aside>;
          // URLs come from the CMS media model and may use arbitrary configured hosts.
          // eslint-disable-next-line @next/next/no-img-element
          case "image": return <figure key={block.id}><img className="grayscale" src={block.data.url} alt={block.data.alt} />{block.data.caption && <figcaption>{block.data.caption}</figcaption>}</figure>;
          case "infobox": return <aside className="article-box" key={block.id}><strong>{block.data.title}</strong><p>{block.data.content}</p></aside>;
        }
      })}
    </div>
  );
}
