import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BarChart3, BookOpenCheck, CheckCircle2, Clock3, Flame, LogOut, Target } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { loadLearningHistory, type TrendItem } from "@/lib/learning-history";
import { loadLearningInsights, loadStudyStreak } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import { levelLabel } from "@/lib/diagnostic-level";
import "./mypage.css";
function date(value: string) { return new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }); }
function status(status: string, passed: boolean | null) {
  if (status === "in_progress") return { label: "진행 중", className: "progress" };
  if (status === "expired") return { label: "시간 종료", className: "expired" };
  if (status === "submitted") return { label: "제출 완료", className: "submitted" };
  return passed ? { label: "합격", className: "passed" } : { label: "불합격", className: "failed" };
}

function ScoreTrend({ items }: { items: TrendItem[] }) {
  if (!items.length) return <div className="chart-empty"><BarChart3 /><p>채점 완료된 시험이 쌓이면 점수 변화가 표시됩니다.</p></div>;
  const left = 42, right = 680, top = 18, bottom = 178;
  const x = (index: number) => items.length === 1 ? (left + right) / 2 : left + (right - left) * index / (items.length - 1);
  const y = (value: number) => bottom - (bottom - top) * value / 100;
  const points = items.map((item, index) => `${x(index)},${y(item.percentage)}`).join(" ");
  return <div className="trend-chart"><svg viewBox="0 0 720 225" role="img" aria-label="최근 점수 변화 그래프"><title>최근 점수 변화</title>{[0, 25, 50, 75, 100].map(value => <g key={value}><line x1={left} x2={right} y1={y(value)} y2={y(value)} className="chart-grid" /><text x="34" y={y(value) + 3} textAnchor="end">{value}</text></g>)}<polyline points={points} className="trend-line" />{items.map((item, index) => <g key={item.id}><circle cx={x(index)} cy={y(item.percentage)} r="4" className={item.passed ? "trend-dot passed" : "trend-dot"}><title>{item.examTitle} {item.percentage}%</title></circle><text x={x(index)} y="205" textAnchor="middle" className="chart-date">{new Date(item.date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}</text></g>)}</svg></div>;
}

export default async function MyPage({ searchParams }: { searchParams: Promise<{ page?: string; exam?: string; cert?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/mypage");
  const [{ data: profile }, learning, insights, streak] = await Promise.all([
    supabase.from("profiles").select("display_name,role").eq("id", user.id).maybeSingle(),
    loadLearningHistory(user.id, Number(query.page ?? 1), String(query.exam ?? "")),
    loadLearningInsights(user.id, String(query.cert ?? "")),
    loadStudyStreak(user.id),
  ]);
  const name = profile?.display_name || user.email?.split("@")[0] || "학습자";
  const linkWith = (params: Record<string, string>) => `/mypage?${new URLSearchParams({ ...(learning.selectedExamId && { exam: learning.selectedExamId }), ...(insights.selected && { cert: insights.selected.code }), ...params })}`;
  const pageHref = (page: number) => linkWith({ page: String(page) });
  const certHref = (code: string) => `${linkWith({ cert: code })}#insights`;

  return <main className="mypage-shell">
    <header><Link className="mypage-brand" href="/" aria-label="랜딩 페이지"><Image src="/logo-mark.png" alt="" width={32} height={32} className="brand-mark" />기출<b>뱅크</b></Link><nav><Link href="/license">기출문제</Link><Link href="/review">오답노트</Link>{profile?.role === "admin" && <Link href="/admin">관리자 콘솔</Link>}<form action={signOut}><button><LogOut />로그아웃</button></form></nav></header>
    <section className="mypage-container">
      <Link className="mypage-back" href="/dashboard"><ArrowLeft />대시보드</Link>
      <div className="mypage-title"><div><span>MY LEARNING REPORT</span><h1>{name}님의 학습 분석</h1><p>응시 기록과 역량별 성취도를 바탕으로 다음 학습 방향을 확인하세요.</p></div><Link href="/license"><BookOpenCheck />기출문제 풀기</Link></div>

      <section className="learning-summary"><article><Clock3 /><div><span>전체 응시</span><strong>{learning.totalAttempts}<small>회</small></strong></div></article><article><BarChart3 /><div><span>평균 점수</span><strong>{learning.summary.averagePercentage}<small>%</small></strong></div></article><article><Target /><div><span>최고 점수</span><strong>{learning.summary.bestPercentage}<small>%</small></strong></div></article><article><CheckCircle2 /><div><span>합격률</span><strong>{learning.summary.passRate}<small>%</small></strong></div></article></section>

      <section className="mypage-panel"><div className="mypage-panel-head"><div><span>SCORE TREND</span><h2>최근 점수 변화</h2><p>최근 채점 완료 12회의 총점을 백분율로 환산했습니다.</p></div><b>{learning.summary.gradedCount}회 채점 완료</b></div><ScoreTrend items={learning.trends} /></section>

      <section className="mypage-panel streak-panel"><div className="mypage-panel-head"><div><span>STUDY STREAK</span><h2>연속 학습</h2><p>회차를 제출하거나 오답을 복습한 날을 학습한 날로 셉니다(한국 시간 기준).</p></div><b>{streak.studiedToday ? "오늘 학습 완료" : streak.current > 0 ? "오늘 이어가면 +1일" : "오늘부터 시작해요"}</b></div>
        <div className="streak-body"><div className="streak-stats"><div><Flame /><strong>{streak.current}<small>일</small></strong><span>현재 연속</span></div><div><strong>{streak.best}<small>일</small></strong><span>최장 연속</span></div><div><strong>{streak.totalDays}<small>일</small></strong><span>총 학습일</span></div></div>
        <div className="streak-grid" aria-label="최근 4주 학습 기록">{streak.recent.map(day => <i key={day.date} title={`${day.date} · ${day.count}문항`} className={day.count === 0 ? "" : day.count < 10 ? "l1" : day.count < 30 ? "l2" : "l3"} />)}</div></div>
      </section>

      <section id="insights" className="mypage-panel"><div className="mypage-panel-head"><div><span>WEAKNESS ANALYSIS</span><h2>자격증별 약점 분석</h2><p>회차 응시와 오답 복습 기록을 합쳐 과목(시대)·유형별 정답률을 계산했습니다.</p></div>{insights.selected && <b>정답률 {insights.selected.accuracy}% · {insights.selected.answered}문항</b>}</div>
        {insights.selected ? <>
          {insights.certifications.length > 1 && <nav className="insight-tabs">{insights.certifications.map(cert => <Link key={cert.code} className={cert.code === insights.selected?.code ? "active" : ""} href={certHref(cert.code)}>{cert.name}</Link>)}</nav>}
          <div className="section-bars">{insights.selected.sections.map(section => <div key={section.key} className={`section-bar level-${section.enough ? section.level : "none"}`}><span>{section.title}</span><div><i style={{ width: `${section.accuracy}%` }} /></div><b>{section.enough ? `${section.accuracy}%` : "표본 부족"}</b><small>{section.correct}/{section.answered}</small></div>)}</div>
          <h3 className="insight-subtitle">자주 틀리는 유형</h3>
          {insights.selected.weakTags.length ? <div className="weak-grid">{insights.selected.weakTags.map(tag => <article className={`level-${tag.level}`} key={tag.key}><div className="weak-top"><div><span>{levelLabel[tag.level]}</span><h3>{tag.title}</h3></div><b>{tag.accuracy}<small>%</small></b></div><div className="weak-meter"><i style={{ width: `${tag.accuracy}%` }} /></div><small>정답 {tag.correct}/{tag.answered}</small></article>)}</div>
            : <p className="insight-note">3문항 이상 풀어본 유형 중 정답률 80% 미만인 유형이 아직 없습니다.</p>}
          <div className="insight-actions"><Link className="insight-practice" href={`/practice?mode=daily&cert=${insights.selected.code}`}><Target />약점 위주 추천 문제 풀기<ArrowRight /></Link><Link className="insight-practice ghost" href={`/review?cert=${insights.selected.code}`}>오답 복습하기<ArrowRight /></Link></div>
        </> : <div className="analysis-empty"><Target /><h3>분석할 풀이 기록이 없습니다</h3><p>기출문제를 제출하면 과목별 정답률과 약점 유형이 표시됩니다.</p></div>}
      </section>

      <section className="mypage-panel history-panel"><div className="mypage-panel-head history-head"><div><span>ATTEMPT HISTORY</span><h2>전체 응시 이력</h2><p>진행 중·완료·시간 종료 기록을 모두 확인할 수 있습니다.</p></div><form method="get"><select name="exam" defaultValue={learning.selectedExamId}><option value="">전체 시험</option>{learning.exams.map(exam => <option value={exam.id} key={exam.id}>{exam.title}</option>)}</select><button>조회</button>{learning.selectedExamId && <Link href="/mypage">초기화</Link>}</form></div>
        {learning.history.length ? <div className="history-list">{learning.history.map(item => { const state = status(item.status, item.passed); const active = item.status === "in_progress"; const result = item.status === "graded" || item.status === "submitted"; const href = active ? `/exams/${item.examSlug}/take` : result ? `/exams/${item.examSlug}/result?attemptId=${item.id}` : ""; return <article key={item.id}><div className="history-date"><b>{date(item.resultAt ?? item.startedAt)}</b><small>{date(item.startedAt)} 시작</small></div><div className="history-exam"><span className={`history-status ${state.className}`}>{state.label}</span><h3>{item.examTitle}</h3><p>{item.correctCount !== null ? `정답 ${item.correctCount}개 · ` : ""}응답 {item.answeredCount}개</p></div><div className="history-score">{item.totalScore !== null ? <><strong>{item.totalScore}<small>/{item.maxScore}점</small></strong><span>{item.percentage}%</span></> : <span>채점 전</span>}</div>{href ? <Link href={href}>{active ? "이어 풀기" : "결과 보기"}<ArrowRight /></Link> : <span className="no-action">종료</span>}</article>; })}</div> : <div className="history-empty"><p>조건에 맞는 응시 기록이 없습니다.</p><Link href="/license">기출문제 풀기</Link></div>}
        {learning.totalPages > 1 && <nav className="pagination"><Link className={learning.currentPage === 1 ? "disabled" : ""} href={pageHref(Math.max(1, learning.currentPage - 1))}>이전</Link>{Array.from({ length: learning.totalPages }, (_, index) => index + 1).map(page => <Link className={page === learning.currentPage ? "active" : ""} href={pageHref(page)} key={page}>{page}</Link>)}<Link className={learning.currentPage === learning.totalPages ? "disabled" : ""} href={pageHref(Math.min(learning.totalPages, learning.currentPage + 1))}>다음</Link></nav>}
      </section>
    </section>
  </main>;
}
