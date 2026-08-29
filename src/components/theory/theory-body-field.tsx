"use client";

import { useRef, useState } from "react";
import { Eye, EyeOff, ImageUp } from "lucide-react";
import { uploadTheoryImageAction } from "@/app/admin/actions";
import { MarkdownBody } from "@/components/theory/markdown-body";

export function TheoryBodyField({ name, defaultValue = "", required }: { name: string; defaultValue?: string; required?: boolean }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);

  function insertAtCursor(snippet: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + snippet + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el?.focus();
      const cursor = start + snippet.length;
      el?.setSelectionRange(cursor, cursor);
    });
  }

  async function handleFile(file: File) {
    setError("");
    setUploading(true);
    const uploadData = new FormData();
    uploadData.set("file", file);
    const result = await uploadTheoryImageAction(uploadData);
    setUploading(false);
    if ("error" in result) { setError(result.error); return; }
    insertAtCursor(`\n![](${result.url})\n`);
  }

  return <div className="theory-body-field">
    <div className="theory-body-toolbar">
      <button type="button" className="admin-secondary" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
        <ImageUp />{uploading ? "업로드 중..." : "이미지 삽입"}
      </button>
      <button type="button" className="admin-secondary" onClick={() => setPreview((prev) => !prev)}>
        {preview ? <EyeOff /> : <Eye />}{preview ? "편집으로" : "미리보기"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) handleFile(file);
        }}
      />
    </div>
    {error && <p className="theory-body-error">{error}</p>}
    {preview && <div className="theory-body-preview"><MarkdownBody text={value || "_미리볼 내용이 없습니다._"} /></div>}
    <textarea
      ref={textareaRef}
      name={name}
      rows={6}
      required={required}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      className="theory-body-textarea"
      style={preview ? { display: "none" } : undefined}
    />
  </div>;
}
