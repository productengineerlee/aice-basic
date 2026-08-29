import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownBody({ text, className }: { text: string; className?: string }) {
  return <div className={`markdown-body${className ? ` ${className}` : ""}`}>
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
  </div>;
}
