import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { ExamHeader } from "@/components/exams/exam-header";
import { PracticeRunner } from "@/components/practice/practice-runner";
import { createClient } from "@/lib/supabase/server";
import { listCertifications } from "@/lib/certifications";
import { loadPracticeQueue, type PracticeScope } from "@/lib/review";
import { loadDailySet } from "@/lib/recommend";
import "../exams/exams.css";
import "../review/review.css";
import "./practice.css";

export const dynamic = "force-dynamic";

type Query = { cert?: string; scope?: string; mode?: string };

export default async function PracticePage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const cert = String(query.cert ?? "");
  const mode = query.mode === "daily" ? "daily" : "review";
  const scope: PracticeScope = query.scope === "all" ? "all" : "due";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const params = new URLSearchParams({ ...(mode === "daily" && { mode }), ...(cert && { cert }), ...(scope === "all" && { scope }) });
    redirect(`/auth/login?next=${encodeURIComponent(`/practice?${params}`)}`);
  }

  return <main className="exam-app">
    <ExamHeader />
    <section className="exam-container practice-container">
      {mode === "daily" ? await DailyPractice({ userId: user.id, cert }) : await ReviewPractice({ userId: user.id, cert, scope })}
    </section>
  </main>;
}

async function DailyPractice({ userId, cert }: { userId: string; cert: string }) {
  const set = cert ? await loadDailySet(userId, cert) : null;

  if (!set) {
    const certifications = await listCertifications();
    return <div className="review-empty">
      <h2>오늘의 추천 문제</h2>
      <p>복습할 오답, 약한 과목, 아직 안 푼 문제를 섞어 매일 10문제를 골라 드립니다. 자격증을 선택하세요.</p>
      <div className="daily-cert-list">{certifications.map((item) => <Link key={item.code} href={`/practice?mode=daily&cert=${item.code}`}>{item.name}<ArrowRight /></Link>)}</div>
    </div>;
  }

  if (!set.questions.length) {
    return <div className="review-empty">
      <CheckCircle2 />
      <h2>{set.total ? "오늘의 추천 문제를 모두 풀었어요" : "추천할 문제가 없습니다"}</h2>
      <p>{set.total ? `${set.certName} 추천 ${set.total}문제를 끝냈습니다. 내일 새로운 문제로 다시 추천해 드릴게요.` : "등록된 기출문제가 없습니다."}</p>
      <Link href={`/license/${set.certCode}`}>회차별 기출 풀기</Link>
      <p><Link className="practice-text-link" href={`/review?cert=${set.certCode}`}>오답노트 보기</Link></p>
    </div>;
  }

  return <PracticeRunner
    questions={set.questions}
    title={`${set.certName} · 오늘의 추천 ${set.total}문제${set.doneToday ? ` (${set.doneToday}문제 완료, 이어 풀기)` : ""}`}
    mode="daily"
    doneHref={`/mypage?cert=${set.certCode}#insights`}
    doneLabel="약점 분석 보기"
  />;
}

async function ReviewPractice({ userId, cert, scope }: { userId: string; cert: string; scope: PracticeScope }) {
  const queue = await loadPracticeQueue(userId, cert, scope);
  const reviewHref = cert ? `/review?cert=${encodeURIComponent(cert)}` : "/review";

  if (!queue.questions.length) {
    return <div className="review-empty">
      <CheckCircle2 />
      <h2>{queue.activeCount === 0 ? "남은 오답이 없습니다" : "오늘 복습할 문제를 모두 끝냈어요"}</h2>
      <p>{queue.activeCount === 0 ? "기출 회차를 풀면 틀린 문제가 오답노트에 쌓입니다." : `남은 오답 ${queue.activeCount}문제는 복습일이 되면 다시 나옵니다.`}</p>
      {queue.activeCount > 0 && <Link href={`/practice?${new URLSearchParams({ ...(cert && { cert }), scope: "all" })}`}>남은 오답 미리 풀어보기</Link>}
      <p><Link className="practice-text-link" href={reviewHref}>오답노트로 돌아가기</Link></p>
    </div>;
  }

  return <PracticeRunner
    questions={queue.questions}
    title={`${queue.certName ?? "전체"} · ${scope === "due" ? "오늘 복습" : "남은 오답 미리 풀기"}`}
    mode="review"
    earlyPractice={scope === "all"}
    doneHref={reviewHref}
    doneLabel="오답노트로 돌아가기"
  />;
}
