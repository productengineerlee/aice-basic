import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, Building2, Landmark, Sparkles, type LucideIcon } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import type { CertificationSummary } from "@/lib/certifications";

/** 자격증별 아이콘·색. 새 자격증은 기본값(파랑)으로 표시된다. */
const CERT_STYLE: Record<string, { icon: LucideIcon; tint: string; chip: string }> = {
  "korean-history": { icon: Landmark, tint: "bg-amber-50 text-amber-600", chip: "bg-amber-100 text-amber-700" },
  gongin: { icon: Building2, tint: "bg-emerald-50 text-emerald-600", chip: "bg-emerald-100 text-emerald-700" },
  "mgmt-viz": { icon: BarChart3, tint: "bg-violet-50 text-violet-600", chip: "bg-violet-100 text-violet-700" },
};
const DEFAULT_STYLE = { icon: BookOpen, tint: "bg-blue-50 text-blue-600", chip: "bg-blue-100 text-blue-700" };
export const certStyle = (code: string) => CERT_STYLE[code] ?? DEFAULT_STYLE;

export function HomeHeader({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900">
          <Image src="/mascot.png" alt="" width={34} height={34} priority />
          <span>기출<span className="text-blue-600">뱅크</span></span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-semibold text-slate-600 sm:flex">
          <Link className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-900" href="/license">기출문제</Link>
          {loggedIn && <Link className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-900" href="/review">오답노트</Link>}
          {loggedIn && <Link className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-900" href="/mypage">학습 분석</Link>}
          <Link className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-900" href="/qna">QnA</Link>
        </nav>
        <div className="flex items-center gap-2 text-sm font-semibold">
          {loggedIn ? (
            <>
              <Link className="rounded-full bg-slate-900 px-4 py-2 text-white hover:bg-slate-700" href="/dashboard">내 학습</Link>
              <form action={signOut}><button className="rounded-full px-3 py-2 text-slate-500 hover:text-slate-900" type="submit">로그아웃</button></form>
            </>
          ) : (
            <>
              <Link className="rounded-full px-3 py-2 text-slate-600 hover:text-slate-900" href="/auth/login">로그인</Link>
              <Link className="rounded-full bg-blue-600 px-4 py-2 text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700" href="/auth/signup">무료로 시작</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function CertGrid({ certifications, loggedIn }: { certifications: CertificationSummary[]; loggedIn: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {certifications.map((cert) => {
        const style = certStyle(cert.code);
        const Icon = style.icon;
        return (
          <article key={cert.code} className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-900/5">
            <div className="flex items-center justify-between">
              <span className={`grid size-12 place-items-center rounded-2xl ${style.tint}`}><Icon className="size-6" /></span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${style.chip}`}>기출 {cert.examCount}회차</span>
            </div>
            <h3 className="mt-5 text-lg font-extrabold text-slate-900">{cert.name}</h3>
            {cert.description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500">{cert.description}</p>}
            <div className="mt-auto flex gap-2 pt-5 text-sm font-bold">
              <Link className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-slate-100 px-3 py-2.5 text-slate-700 hover:bg-slate-200" href={`/license/${cert.code}`}>회차 풀기</Link>
              <Link className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-2.5 text-white hover:bg-blue-700" href={loggedIn ? `/practice?mode=daily&cert=${cert.code}` : "/auth/signup"}>
                <Sparkles className="size-4" />오늘의 10문제
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: { href: string; label: string } }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-bold text-blue-600">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-slate-500">{description}</p>}
      </div>
      {action && <Link className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700" href={action.href}>{action.label}<ArrowRight className="size-4" /></Link>}
    </div>
  );
}

export function HomeFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500">
        <div className="flex items-center gap-2 font-extrabold text-slate-800">
          <Image src="/mascot.png" alt="" width={24} height={24} /><span>기출<span className="text-blue-600">뱅크</span></span>
          <span className="ml-2 font-normal text-slate-400">국가자격·공무원 기출문제 무료 풀이</span>
        </div>
        <nav className="flex gap-4">
          <Link className="hover:text-slate-800" href="/terms">이용약관</Link>
          <Link className="font-semibold hover:text-slate-800" href="/privacy">개인정보처리방침</Link>
          <Link className="hover:text-slate-800" href="/qna">문의(QnA)</Link>
        </nav>
        <p className="w-full text-xs text-slate-400">본 서비스는 각 시험의 공식 사이트가 아닌 학습용 서비스입니다. 기출문제의 저작권은 각 시험 시행기관에 있습니다. © 2026 기출뱅크</p>
      </div>
    </footer>
  );
}
