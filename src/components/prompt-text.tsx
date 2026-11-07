import { formatPrompt } from "@/lib/format-prompt";

/** 문항 지문 표시. ``` 로 감싼 부분은 코드 블록(고정폭·들여쓰기 유지)으로, 나머지는 formatPrompt 로 정리해 보여 준다. */
export function PromptText({ prompt, className }: { prompt: string; className?: string }) {
  // split 의 캡처 그룹 때문에 홀수 번째 조각이 코드 본문이다
  const parts = prompt.split(/```[a-zA-Z]*\n?([\s\S]*?)```/);
  if (parts.length === 1) return <div className={className}>{formatPrompt(prompt)}</div>;
  return (
    <div className={className}>
      {parts.map((part, index) =>
        index % 2 === 1
          ? <pre key={index} className="prompt-code"><code>{part.replace(/\n$/, "")}</code></pre>
          : part.trim() && <span key={index}>{formatPrompt(part.trim())}</span>,
      )}
    </div>
  );
}
