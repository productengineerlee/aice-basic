import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { ExamHeader } from "@/components/exams/exam-header";
import { PracticeRunner } from "@/components/practice/practice-runner";
import { createClient } from "@/lib/supabase/server";
import { loadPracticeQueue, type PracticeScope } from "@/lib/review";
import "../exams/exams.css";
import "../review/review.css";
import "./practice.css";

export const dynamic = "force-dynamic";

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ cert?: string; scope?: string }> }) {
  const query = await searchParams;
  const cert = String(query.cert ?? "");
  const scope: PracticeScope = query.scope === "all" ? "all" : "due";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/practice?${new URLSearchParams({ ...(cert && { cert }), ...(scope === "all" && { scope }) })}`)}`);

  const queue = await loadPracticeQueue(user.id, cert, scope);
  const reviewHref = cert ? `/review?cert=${encodeURIComponent(cert)}` : "/review";

  return <main className="exam-app">
    <ExamHeader />
    <section className="exam-container practice-container">
      {queue.questions.length === 0 ? (
        <div className="review-empty">
          <CheckCircle2 />
          <h2>{queue.activeCount === 0 ? "남은 오답이 없습니다" : "오늘 복습할 문제를 모두 끝냈어요"}</h2>
          <p>{queue.activeCount === 0 ? "기출 회차를 풀면 틀린 문제가 오답노트에 쌓입니다." : `남은 오답 ${queue.activeCount}문제는 복습일이 되면 다시 나옵니다.`}</p>
          {queue.activeCount > 0 && <Link href={`/practice?${new URLSearchParams({ ...(cert && { cert }), scope: "all" })}`}>남은 오답 미리 풀어보기</Link>}
          <p><Link className="practice-text-link" href={reviewHref}>오답노트로 돌아가기</Link></p>
        </div>
      ) : (
        <PracticeRunner
          questions={queue.questions}
          title={`${queue.certName ?? "전체"} · ${scope === "due" ? "오늘 복습" : "남은 오답 미리 풀기"}`}
          earlyPractice={scope === "all"}
          reviewHref={reviewHref}
        />
      )}
    </section>
  </main>;
}
