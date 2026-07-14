"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export function ErrorScreen({ error, reset, title = "화면을 불러오지 못했습니다", backHref = "/dashboard", backLabel = "대시보드로 이동" }: { error: Error & { digest?: string }; reset: () => void; title?: string; backHref?: string; backLabel?: string }) {
  useEffect(() => { console.error("Page error boundary", error); }, [error]);
  return <main className="system-state error-state"><AlertTriangle /><span>SOMETHING WENT WRONG</span><h1>{title}</h1><p>일시적인 네트워크 또는 서버 문제일 수 있습니다. 잠시 후 다시 시도해 주세요.</p>{error.digest && <small>오류 참조: {error.digest}</small>}<div><button onClick={reset}><RotateCcw />다시 시도</button><Link href={backHref}>{backLabel}</Link></div></main>;
}
