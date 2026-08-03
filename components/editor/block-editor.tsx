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

export function BlockEditor({ initialBlocks, inputName = "blocks" }: { initialBlocks: Block[]; inputName?: string }) {
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
      {blocks.map((block, index) => (
        <section className="editor-block" key={block.id}>
          <header className="editor-block-header">
            <span>{blockRegistry[block.type].label}</span>
            <span className="flex gap-1">
              <button className="btn btn-icon btn-ghost" type="button" onClick={() => move(index, -1)} aria-label="Flyt op"><ChevronUp size={16} /></button>
              <button className="btn btn-icon btn-ghost" type="button" onClick={() => move(index, 1)} aria-label="Flyt ned"><ChevronDown size={16} /></button>
              <button className="btn btn-icon btn-ghost" type="button" onClick={() => setBlocks((all) => all.filter((_, i) => i !== index))} aria-label="Slet blok"><Trash2 size={16} /></button>
            </span>
          </header>
          {block.type === "paragraph" && <ParagraphEditor value={block.data.content} onChange={(content) => update(index, { content })} />}
          {(block.type === "heading" || block.type === "subheading" || block.type === "manchet") && (
            <input className="input" value={block.data.text} onChange={(event) => update(index, { ...block.data, text: event.target.value })} />
          )}
          {block.type === "quote" && <><textarea className="input" value={block.data.quote} onChange={(event) => update(index, { ...block.data, quote: event.target.value })} /><input className="input" placeholder="Kilde" value={block.data.attribution ?? ""} onChange={(event) => update(index, { ...block.data, attribution: event.target.value })} /></>}
          {(block.type === "factbox" || block.type === "infobox") && <><input className="input" value={block.data.title} onChange={(event) => update(index, { ...block.data, title: event.target.value })} /><textarea className="input" value={block.data.content} onChange={(event) => update(index, { ...block.data, content: event.target.value })} /></>}
          {block.type === "image" && <><input className="input" type="url" value={block.data.url} onChange={(event) => update(index, { ...block.data, url: event.target.value })} /><input className="input" placeholder="Alt-tekst" value={block.data.alt} onChange={(event) => update(index, { ...block.data, alt: event.target.value })} /><input className="input" placeholder="Billedtekst" value={block.data.caption ?? ""} onChange={(event) => update(index, { ...block.data, caption: event.target.value })} /></>}
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
