import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, BookX, CheckCircle2, FileCheck2, GraduationCap, RotateCcw, Sparkles } from "lucide-react";
import type { CertificationSummary } from "@/lib/certifications";
import type { SiteStats } from "@/lib/exams";
import { CertGrid, SectionTitle } from "./home-parts";

const FEATURES = [
  { icon: FileCheck2, title: "회차별 실전 기출", body: "실제 시험과 같은 시간·배점으로 회차 전체를 풀고, 제출 즉시 채점 결과를 받아요.", tint: "bg-blue-50 text-blue-600" },
  { icon: BookX, title: "오답노트 자동 저장", body: "틀린 문제는 알아서 오답노트에 모여요. 정답과 함께 언제든 다시 확인할 수 있어요.", tint: "bg-rose-50 text-rose-500" },
  { icon: BarChart3, title: "과목별 약점 분석", body: "과목·시대별 정답률과 자주 틀리는 유형을 한눈에 보여 드려요.", tint: "bg-emerald-50 text-emerald-600" },
  { icon: Sparkles, title: "오늘의 추천 10문제", body: "복습할 오답, 약한 과목, 아직 안 푼 문제를 섞어 매일 10문제를 골라 드려요.", tint: "bg-violet-50 text-violet-600" },
];

const LOOP = [
  { icon: FileCheck2, title: "기출 풀기", body: "회차 또는 추천 10문제" },
  { icon: BookX, title: "오답 저장", body: "틀린 문제는 자동으로" },
  { icon: RotateCcw, title: "간격 복습", body: "1일 · 3일 · 7일 뒤 다시" },
  { icon: GraduationCap, title: "졸업", body: "3번 연속 맞히면 완료" },
];

function AppPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-blue-200/60 via-violet-200/50 to-amber-100/60 blur-2xl" />
      <div className="rounded-3xl border border-white/70 bg-white p-6 shadow-2xl shadow-blue-900/10">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-blue-600">한국사 · 오늘의 추천</span>
          <span className="font-extrabold text-slate-800">3 / 10</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[30%] rounded-full bg-gradient-to-r from-blue-500 to-violet-500" /></div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-700">약점 · 근대</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">제74회 · 31번</span>
        </div>
        <p className="mt-3 font-bold leading-relaxed text-slate-800">밑줄 그은 &lsquo;이 사건&rsquo; 이후에 있었던 사실로 옳은 것은?</p>
        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-slate-600"><span className="grid size-6 place-items-center rounded-full bg-slate-100 text-xs font-bold">1</span>별기군이 창설되었다.</li>
          <li className="flex items-center gap-3 rounded-xl border-2 border-emerald-400 bg-emerald-50 px-3 py-2.5 font-semibold text-emerald-800"><span className="grid size-6 place-items-center rounded-full bg-emerald-500 text-xs font-bold text-white">2</span>홍범 14조가 반포되었다.<CheckCircle2 className="ml-auto size-5 text-emerald-500" /></li>
          <li className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-slate-600"><span className="grid size-6 place-items-center rounded-full bg-slate-100 text-xs font-bold">3</span>통리기무아문이 설치되었다.</li>
        </ul>
        <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><b>정답입니다!</b> 연속 정답 2/3 · 7일 후 다시 복습해요.</div>
      </div>
      <Image src="/mascot.png" alt="기출뱅크 마스코트" width={128} height={128} className="absolute -right-6 -bottom-10 w-24 drop-shadow-xl sm:-right-12 sm:w-32" />
      <p className="sr-only">예시 화면입니다.</p>
    </div>
  );
}

export function GuestHome({ certifications, stats }: { certifications: CertificationSummary[]; stats: SiteStats }) {
  const rounds = certifications.reduce((sum, cert) => sum + cert.examCount, 0);
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="pointer-events-none absolute -top-40 -left-32 size-96 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="pointer-events-none absolute top-20 -right-24 size-80 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pt-14 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-28">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-blue-700 shadow-sm ring-1 ring-blue-100"><Sparkles className="size-4" />국가자격·공무원 기출문제, 전부 무료</span>
            <h1 className="mt-6 text-4xl leading-[1.2] font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              오늘도 기출 10문제,<br />
              <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">약점은 기출뱅크가</span><br className="sm:hidden" /> 찾아줄게요
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">회차별 기출을 실전처럼 풀고, 틀린 문제는 오답노트에 자동으로. 과목별 약점을 분석해 매일 풀 문제를 추천해 드려요.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition hover:-translate-y-0.5 hover:bg-blue-700" href="/auth/signup">무료로 시작하기<ArrowRight className="size-5" /></Link>
              <Link className="flex items-center gap-2 rounded-2xl bg-white px-6 py-4 text-base font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50" href="/license">기출문제 둘러보기</Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-500">
              {["회원가입만 하면 무료", "답안 자동 저장", "즉시 채점·정답 확인"].map((item) => <li key={item} className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-500" />{item}</li>)}
            </ul>
          </div>
          <AppPreview />
        </div>
      </section>

      {/* STATS */}
      <section className="mx-auto -mt-8 max-w-6xl px-5">
        <dl className="grid grid-cols-2 gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4 sm:p-6">
          {[
            { label: "제공 자격증", value: `${certifications.length}종` },
            { label: "기출 회차", value: `${rounds}회차` },
            { label: "누적 응시", value: `${stats.attemptCount.toLocaleString("ko-KR")}회` },
            { label: "누적 문제 풀이", value: `${stats.answeredCount.toLocaleString("ko-KR")}문항` },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl px-3 py-2 text-center">
              <dd className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{item.value}</dd>
              <dt className="mt-1 text-sm text-slate-500">{item.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* CERTIFICATIONS */}
      <section id="certifications" className="mx-auto max-w-6xl px-5 py-20">
        <SectionTitle eyebrow="기출문제" title="어떤 시험을 준비하세요?" description="회차 전체를 실전처럼 풀거나, 오늘의 추천 10문제로 가볍게 시작하세요." action={{ href: "/license", label: "전체 자격증 보기" }} />
        <CertGrid certifications={certifications} loggedIn={false} />
        <p className="mt-6 text-center text-sm text-slate-400">국가전문자격·공무원 시험 기출문제가 순차적으로 추가됩니다.</p>
      </section>

      {/* FEATURES */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <SectionTitle eyebrow="기출뱅크로 공부하면" title="풀기만 하면, 나머지는 알아서" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body, tint }) => (
              <article key={title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
                <span className={`grid size-12 place-items-center rounded-2xl ${tint}`}><Icon className="size-6" /></span>
                <h3 className="mt-5 text-lg font-extrabold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* LEARNING LOOP */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <SectionTitle eyebrow="오답이 실력이 되는 과정" title="틀린 문제는 졸업할 때까지 다시 만나요" description="망각 곡선에 맞춰 1일·3일·7일 간격으로 복습하고, 3번 연속 맞히면 오답노트에서 졸업해요." />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LOOP.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="relative rounded-3xl border border-slate-200 bg-white p-6">
              <span className="text-sm font-extrabold text-blue-600">STEP {index + 1}</span>
              <Icon className="mt-3 size-7 text-slate-800" />
              <h3 className="mt-3 text-lg font-extrabold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-500">{body}</p>
              {index < LOOP.length - 1 && <ArrowRight className="absolute top-1/2 -right-3.5 hidden size-5 -translate-y-1/2 text-slate-300 lg:block" />}
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="px-5 pb-20">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-600 to-violet-600 px-8 py-14 text-center text-white sm:px-14">
          <Image src="/mascot.png" alt="" width={110} height={110} className="mx-auto mb-4 w-20 drop-shadow-lg" />
          <h2 className="text-2xl font-extrabold sm:text-3xl">오늘의 10문제부터 시작해 볼까요?</h2>
          <p className="mt-3 text-blue-100">가입은 1분, 기출문제와 오답노트·약점 분석은 모두 무료예요.</p>
          <Link className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 font-bold text-blue-700 shadow-lg hover:bg-blue-50" href="/auth/signup">무료로 시작하기<ArrowRight className="size-5" /></Link>
        </div>
      </section>
    </>
  );
}
