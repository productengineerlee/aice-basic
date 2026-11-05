import Link from "next/link";
import { ArrowRight, BookX, ClipboardCheck, Sparkles } from "lucide-react";
import { CertGrid, HomeFooter, HomeHeader } from "@/components/home/home-parts";
import { listCertifications } from "@/lib/certifications";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: ClipboardCheck, tint: "bg-blue-50 text-blue-600", title: "회차별로 풀기", body: "실제 시험처럼 시간을 재며 한 회차를 풀고, 과목별 점수와 해설을 바로 확인해요." },
  { icon: BookX, tint: "bg-rose-50 text-rose-500", title: "틀린 문제는 오답노트로", body: "틀린 문제는 자동으로 모이고 1·3·7일 간격으로 다시 풀어 3번 맞히면 졸업해요." },
  { icon: Sparkles, tint: "bg-violet-50 text-violet-600", title: "오늘의 10문제", body: "오답 복습, 약한 과목, 아직 안 푼 문제를 섞어 매일 10문제를 골라 드려요." },
];

export default async function LicensePage() {
  const supabase = await createClient();
  const [{ data: { user } }, certifications] = await Promise.all([supabase.auth.getUser(), listCertifications()]);
  const loggedIn = Boolean(user);
  const examTotal = certifications.reduce((sum, cert) => sum + cert.examCount, 0);
  const questionTotal = certifications.reduce((sum, cert) => sum + cert.questionCount, 0);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <HomeHeader loggedIn={loggedIn} />
      <main>
        <section className="bg-gradient-to-b from-blue-50 via-white to-white">
          <div className="mx-auto max-w-6xl px-5 pt-14 pb-10">
            <p className="text-sm font-bold text-blue-600">기출문제</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">어떤 시험을 준비하세요?</h1>
            <p className="mt-3 max-w-2xl text-slate-500 [word-break:keep-all]">국가자격 기출문제를 회차별로 무료로 풀어 보세요. 풀수록 문항별 정오답이 쌓여 약한 과목과 다시 볼 문제를 골라 드려요.</p>
            {certifications.length > 0 && (
              <dl className="mt-6 flex flex-wrap gap-2 text-sm">
                {[["자격증", `${certifications.length}종`], ["기출", `${examTotal}회차`], ["문항", `${questionTotal.toLocaleString("ko-KR")}개`], ["해설", "전 문항"]].map(([label, value]) => (
                  <div key={label} className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
                    <dt className="text-slate-500">{label}</dt><dd className="font-extrabold text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-14">
          {certifications.length === 0
            ? <p className="rounded-3xl border border-dashed border-slate-300 py-16 text-center text-slate-500">준비 중인 자격증이 없습니다.</p>
            : <CertGrid certifications={certifications} loggedIn={loggedIn} />}
        </section>

        <section className="bg-slate-50">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <p className="text-sm font-bold text-blue-600">공부 방법</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">기출뱅크로 이렇게 공부해 보세요</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, tint, title, body }, index) => (
                <li key={title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center gap-3">
                    <span className={`grid size-11 place-items-center rounded-2xl ${tint}`}><Icon className="size-5" /></span>
                    <span className="text-xs font-extrabold text-slate-400">STEP {index + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-extrabold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500 [word-break:keep-all]">{body}</p>
                </li>
              ))}
            </ol>
            {!loggedIn && (
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-br from-blue-600 to-violet-600 px-6 py-6 text-white">
                <div>
                  <p className="text-lg font-extrabold">회원가입하면 오답노트와 오늘의 10문제가 열려요</p>
                  <p className="mt-1 text-sm text-blue-100">가입은 무료이고, 회차 풀이는 로그인 후 바로 시작할 수 있어요.</p>
                </div>
                <Link href="/auth/signup" className="flex items-center gap-1 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50">무료로 시작하기<ArrowRight className="size-4" /></Link>
              </div>
            )}
          </div>
        </section>
      </main>
      <HomeFooter />
    </div>
  );
}
