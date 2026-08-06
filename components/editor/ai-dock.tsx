"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { ChatInterface } from "@/app/(admin)/chat/chat-interface";

type Message = { role: "user" | "assistant"; content: string };

export function AiDock({ sessionId, initialMessages, children }: {
  sessionId: string; initialMessages: Message[]; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ai-dock-layout">
      <div className="ai-dock-content">{children}</div>
      {open && (
        <aside className="ai-dock-panel">
          <div className="ai-dock-header">
            <span className="ai-dock-title"><Sparkles size={14} /> AI-assistent</span>
            <button className="btn btn-icon btn-ghost" onClick={() => setOpen(false)} aria-label="Luk"><X size={16} /></button>
          </div>
          <div className="ai-dock-body">
            <ChatInterface sessionId={sessionId} initialMessages={initialMessages} />
          </div>
        </aside>
      )}
      <button
        className="ai-dock-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Skjul AI-assistent" : "Vis AI-assistent"}
        style={open ? { display: "none" } : undefined}
      >
        <Sparkles size={16} /> AI-assistent
      </button>
    </div>
  );
}
