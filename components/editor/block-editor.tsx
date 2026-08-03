"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { blockRegistry } from "@/lib/blocks/registry";
import type { Block, BlockType } from "@/lib/blocks/schema";

function ParagraphEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false })],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });
  return <EditorContent editor={editor} className="block-prose input" />;
}

type MediaOption = { id: string; url: string; altTekst: string | null; billedtekst: string | null; filnavn: string | null };

export function BlockEditor({ initialBlocks, media = [], inputName = "blocks" }: { initialBlocks: Block[]; media?: MediaOption[]; inputName?: string }) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [newType, setNewType] = useState<BlockType>("paragraph");

  function update(index: number, data: Block["data"]) {
    setBlocks((current) => current.map((block, i) => i === index ? { ...block, data } as Block : block));
  }

  function move(index: number, direction: -1 | 1) {
    setBlocks((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  return (
    <div className="block-editor">
      <input type="hidden" name={inputName} value={JSON.stringify(blocks)} />
      {blocks.length === 0 && (
        <div className="empty-state" style={{ borderBottom: "1px solid var(--color-divider)", fontSize: 13 }}>
          Ingen blokke endnu. Vælg en bloktype herunder og klik Tilføj blok.
        </div>
      )}
      {blocks.map((block, index) => (
        <section className="editor-block" key={block.id}>
          <header className="editor-block-header">
            <span>{blockRegistry[block.type].label}</span>
            <span className="flex gap-1">
              <button className="btn btn-icon btn-ghost" type="button" onClick={() => move(index, -1)} aria-label="Flyt op"><ChevronUp size={16} /></button>
              <button className="btn btn-icon btn-ghost" type="button" onClick={() => move(index, 1)} aria-label="Flyt ned"><ChevronDown size={16} /></button>
              <button className="btn btn-icon btn-ghost" type="button" onClick={() => { if (!window.confirm("Slet denne blok?")) return; setBlocks((all) => all.filter((_, i) => i !== index)); }} aria-label="Slet blok"><Trash2 size={16} /></button>
            </span>
          </header>
          {block.type === "paragraph" && <ParagraphEditor value={block.data.content} onChange={(content) => update(index, { content })} />}
          {(block.type === "heading" || block.type === "subheading" || block.type === "manchet") && (
            <input className="input" value={block.data.text} onChange={(event) => update(index, { ...block.data, text: event.target.value })} />
          )}
          {block.type === "quote" && <><textarea className="input" value={block.data.quote} onChange={(event) => update(index, { ...block.data, quote: event.target.value })} /><input className="input" placeholder="Kilde" value={block.data.attribution ?? ""} onChange={(event) => update(index, { ...block.data, attribution: event.target.value })} /></>}
          {(block.type === "factbox" || block.type === "infobox") && <><input className="input" value={block.data.title} onChange={(event) => update(index, { ...block.data, title: event.target.value })} /><textarea className="input" value={block.data.content} onChange={(event) => update(index, { ...block.data, content: event.target.value })} /></>}
          {block.type === "image" && <>
            <select className="input" value={block.data.mediaId ?? ""} onChange={(event) => {
              const selected = media.find((item) => item.id === event.target.value);
              if (selected) update(index, { mediaId: selected.id, url: selected.url, alt: selected.altTekst ?? "", caption: selected.billedtekst ?? "" });
              else update(index, { ...block.data, mediaId: "" });
            }}><option value="">Vælg fra mediebiblioteket</option>{media.map((item) => <option key={item.id} value={item.id}>{item.billedtekst || item.filnavn || item.id}</option>)}</select>
            {block.data.url && block.data.url !== "https://" && <div className="editor-image-preview">
              {/* Media hosts are selected dynamically from the CMS library. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={block.data.url} alt="" />
            </div>}
            <div className="field"><label>URL</label><input className="input" value={block.data.url} onChange={(event) => update(index, { ...block.data, mediaId: "", url: event.target.value })} /></div>
            <div className="field"><label>Alt-tekst</label><input className="input" value={block.data.alt} onChange={(event) => update(index, { ...block.data, alt: event.target.value })} /></div>
            <div className="field"><label>Billedtekst</label><input className="input" value={block.data.caption ?? ""} onChange={(event) => update(index, { ...block.data, caption: event.target.value })} /></div>
          </>}
        </section>
      ))}
      <div className="flex gap-2">
        <select className="input" value={newType} onChange={(event) => setNewType(event.target.value as BlockType)}>
          {Object.entries(blockRegistry).map(([type, item]) => <option key={type} value={type}>{item.label}</option>)}
        </select>
        <button className="btn btn-secondary" type="button" onClick={() => setBlocks((current) => [...current, blockRegistry[newType].create(crypto.randomUUID())])}><Plus size={16} /> Tilføj blok</button>
      </div>
    </div>
  );
}
