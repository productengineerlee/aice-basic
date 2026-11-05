import Link from "next/link";
import { ArrowRight, BarChart3, BookX, Flame, PlayCircle, Sparkles, Target } from "lucide-react";
import type { CertificationSummary } from "@/lib/certifications";
import type { AccuracyStat } from "@/lib/insights";
import { CertGrid, SectionTitle } from "./home-parts";

export type MemberSummary = {
  name: string;
  streak: { current: number; best: number; studiedToday: boolean; recent: { date: string; count: number }[] } | null;
  review: { active: number; due: number };
  mainCert: { code: string; name: string; accuracy: number; answered: number; weakest: AccuracyStat | null } | null;
  inProgress: { slug: string; title: string } | null;
};

function streakText(streak: MemberSummary["streak"]) {
  if (!streak || streak.current === 0) return "오늘 첫 학습을 시작해 보세요";
  if (streak.studiedToday) return `${streak.current}일 연속 학습 중 · 오늘도 완료!`;
  return `${streak.current}일 연속 학습 중 · 오늘 풀면 이어져요`;
}

export function MemberHome({ summary, certifications }: { summary: MemberSummary; certifications: CertificationSummary[] }) {
  const { streak, review, mainCert, inProgress } = summary;
  const dailyHref = mainCert ? `/practice?mode=daily&cert=${mainCert.code}` : "/practice?mode=daily";

  return (
    <>
      <section className="bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="mx-auto max-w-6xl px-5 pt-12 pb-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-blue-600">오늘의 학습</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">안녕하세요, {summary.name}님 👋</h1>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-orange-100">
              <span className="grid size-10 place-items-center rounded-xl bg-orange-50"><Flame className="size-6 text-orange-500" /></span>
              <div>
                <p className="text-sm font-extrabold text-slate-900">{streakText(streak)}</p>
                {streak && <div className="mt-1.5 flex gap-1" aria-label="최근 7일 학습 기록">{streak.recent.slice(-7).map((day) => <i key={day.date} title={`${day.date} · ${day.count}문항`} className={`block size-3.5 rounded ${day.count ? "bg-orange-400" : "bg-slate-200"}`} />)}</div>}
              </div>
            </div>
          </div>

          {inProgress && (
            <Link href={`/exams/${inProgress.slug}/take`} className="mt-6 flex items-center gap-3 rounded-2xl bg-amber-50 px-5 py-4 text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
              <PlayCircle className="size-6 shrink-0 text-amber-500" />
              <span className="flex-1 text-sm"><b>풀던 회차가 있어요</b> · {inProgress.title}</span>
              <span className="flex items-center gap-1 text-sm font-bold">이어 풀기<ArrowRight className="size-4" /></span>
            </Link>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Link href={dailyHref} className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-violet-600 p-6 text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5">
              <Sparkles className="size-7" />
              <p className="mt-4 text-sm font-semibold text-blue-100">{mainCert ? mainCert.name : "자격증을 골라 시작"}</p>
              <h2 className="mt-1 text-2xl font-extrabold">오늘의 추천 10문제</h2>
              <p className="mt-2 text-sm text-blue-100">오답 복습 · 약한 과목 · 안 푼 문제를 섞었어요</p>
              <span className="mt-5 inline-flex items-center gap-1 rounded-xl bg-white/15 px-4 py-2 text-sm font-bold group-hover:bg-white/25">시작하기<ArrowRight className="size-4" /></span>
            </Link>

            <Link href={review.due > 0 ? "/practice" : "/review"} className="group rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-rose-200">
              <BookX className="size-7 text-rose-500" />
              <p className="mt-4 text-sm font-semibold text-slate-500">오답노트</p>
              <h2 className="mt-1 text-2xl font-extrabold text-slate-900">{review.due > 0 ? <>오늘 복습 <span className="text-rose-500">{review.due}</span>문제</> : review.active > 0 ? "오늘 복습 완료" : "오답이 없어요"}</h2>
              <p className="mt-2 text-sm text-slate-500">{review.active > 0 ? `남은 오답 ${review.active}문제 · 3번 연속 맞히면 졸업` : "기출을 풀면 틀린 문제가 자동으로 모여요"}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-rose-500">{review.due > 0 ? "복습하기" : "오답노트 보기"}<ArrowRight className="size-4" /></span>
            </Link>

            <Link href={mainCert ? `/mypage?cert=${mainCert.code}#insights` : "/mypage"} className="group rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-emerald-200">
              {mainCert?.weakest ? <Target className="size-7 text-emerald-600" /> : <BarChart3 className="size-7 text-emerald-600" />}
              <p className="mt-4 text-sm font-semibold text-slate-500">{mainCert ? `${mainCert.name} 약점` : "약점 분석"}</p>
              <h2 className="mt-1 text-2xl font-extrabold text-slate-900">{mainCert?.weakest ? <>{mainCert.weakest.title} <span className="text-orange-500">{mainCert.weakest.accuracy}%</span></> : mainCert ? `정답률 ${mainCert.accuracy}%` : "분석 준비 중"}</h2>
              <p className="mt-2 text-sm text-slate-500">{mainCert ? `지금까지 ${mainCert.answered.toLocaleString("ko-KR")}문항 · 전체 정답률 ${mainCert.accuracy}%` : "회차를 풀면 과목별 정답률을 분석해 드려요"}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-emerald-600">학습 분석 보기<ArrowRight className="size-4" /></span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <SectionTitle eyebrow="기출문제" title="회차별 기출 풀기" action={{ href: "/license", label: "전체 자격증 보기" }} />
        <CertGrid certifications={certifications} loggedIn />
      </section>
    </>
  );
}
