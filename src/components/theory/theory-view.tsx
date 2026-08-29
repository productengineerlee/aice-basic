"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { TheorySection } from "@/lib/theory";
import { MarkdownBody } from "@/components/theory/markdown-body";

export function TheoryView({ sections }: { sections: TheorySection[] }) {
  const [activeCode, setActiveCode] = useState(sections[0]?.code ?? "");
  const [open, setOpen] = useState<string[]>([]);
  const active = sections.find((section) => section.code === activeCode) ?? sections[0];

  function toggle(id: string) {
    setOpen((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  if (!active) return <p className="theory-empty">등록된 핵심이론이 없습니다.</p>;

  return <div className="theory-view">
    <nav className="theory-tabs">{sections.map((section) => <button key={section.code} className={section.code === activeCode ? "active" : ""} onClick={() => setActiveCode(section.code)}>{section.title}</button>)}</nav>

    {active.overview && <MarkdownBody text={active.overview.body} className="theory-overview" />}

    {active.topics.length > 0 ? <div className="theory-list">{active.topics.map((topic) => {
      const isOpen = open.includes(topic.id);
      return <details className="theory-item" key={topic.id} open={isOpen} onToggle={(event) => { if (event.currentTarget.open !== isOpen) toggle(topic.id); }}>
        <summary>{topic.title}<ChevronDown className={isOpen ? "rotate" : ""} /></summary>
        <MarkdownBody text={topic.body} className="theory-item-body" />
      </details>;
    })}</div> : <p className="theory-empty">이 영역의 세부 이론은 준비 중입니다.</p>}
  </div>;
}
