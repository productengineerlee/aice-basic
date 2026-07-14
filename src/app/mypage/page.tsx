import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BarChart3, BookOpenCheck, BrainCircuit, CheckCircle2, Clock3, LogOut, Target } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { loadLearningHistory, type TrendItem } from "@/lib/learning-history";
import { createClient } from "@/lib/supabase/server";
import "./mypage.css";

const levelName: Record<string, string> = { foundation: "기초 보강", weak: "집중 보강", developing: "발전 단계", strong: "강점" };
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

export default async function MyPage({ searchParams }: { searchParams: Promise<{ page?: string; exam?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/mypage");
  const [{ data: profile }, learning] = await Promise.all([
    supabase.from("profiles").select("display_name,role").eq("id", user.id).maybeSingle(),
    loadLearningHistory(user.id, Number(query.page ?? 1), String(query.exam ?? "")),
  ]);
  const name = profile?.display_name || user.email?.split("@")[0] || "학습자";
  const pageHref = (page: number) => `/mypage?page=${page}${learning.selectedExamId ? `&exam=${encodeURIComponent(learning.selectedExamId)}` : ""}`;

  return <main className="mypage-shell">
    <header><Link className="mypage-brand" href="/" aria-label="랜딩 페이지"><span><BrainCircuit /></span>AICE <b>LAB</b></Link><nav><Link href="/exams">모의고사</Link>{profile?.role === "admin" && <Link href="/admin">관리자 콘솔</Link>}<form action={signOut}><button><LogOut />로그아웃</button></form></nav></header>
    <section className="mypage-container">
      <Link className="mypage-back" href="/dashboard"><ArrowLeft />대시보드</Link>
      <div className="mypage-title"><div><span>MY LEARNING REPORT</span><h1>{name}님의 학습 분석</h1><p>응시 기록과 역량별 성취도를 바탕으로 다음 학습 방향을 확인하세요.</p></div><Link href="/exams"><BookOpenCheck />새 모의고사</Link></div>

      <section className="learning-summary"><article><Clock3 /><div><span>전체 응시</span><strong>{learning.totalAttempts}<small>회</small></strong></div></article><article><BarChart3 /><div><span>평균 점수</span><strong>{learning.summary.averagePercentage}<small>%</small></strong></div></article><article><Target /><div><span>최고 점수</span><strong>{learning.summary.bestPercentage}<small>%</small></strong></div></article><article><CheckCircle2 /><div><span>합격률</span><strong>{learning.summary.passRate}<small>%</small></strong></div></article></section>

      <section className="mypage-panel"><div className="mypage-panel-head"><div><span>SCORE TREND</span><h2>최근 점수 변화</h2><p>최근 채점 완료 12회의 총점을 백분율로 환산했습니다.</p></div><b>{learning.summary.gradedCount}회 채점 완료</b></div><ScoreTrend items={learning.trends} /></section>

      <section className="mypage-panel"><div className="mypage-panel-head"><div><span>WEAK COMPETENCIES</span><h2>우선 보강 역량</h2><p>최근 최대 {learning.analyticsAttemptCount}회의 문항 태그와 배점을 종합한 결과입니다.</p></div></div>{learning.competencies.length ? <div className="weak-grid">{learning.competencies.slice(0, 8).map(item => <article className={`level-${item.level}`} key={item.tag}><div className="weak-top"><div><span>{levelName[item.level] ?? item.level}</span><h3>{item.tag}</h3></div><b>{item.percentage}<small>%</small></b></div><div className="weak-meter"><i style={{ width: `${item.percentage}%` }} /></div><small>정답 {item.correctCount}/{item.questionCount} · {item.earnedScore}/{item.maxScore}점</small><p>{item.comment}</p><strong>추천 학습</strong><p>{item.recommendation}</p></article>)}</div> : <div className="analysis-empty"><Target /><h3>분석할 응시 결과가 없습니다</h3><p>모의고사를 제출하면 취약 역량과 보강 방법이 표시됩니다.</p></div>}</section>

      <section className="mypage-panel history-panel"><div className="mypage-panel-head history-head"><div><span>ATTEMPT HISTORY</span><h2>전체 응시 이력</h2><p>진행 중·완료·시간 종료 기록을 모두 확인할 수 있습니다.</p></div><form method="get"><select name="exam" defaultValue={learning.selectedExamId}><option value="">전체 시험</option>{learning.exams.map(exam => <option value={exam.id} key={exam.id}>{exam.title}</option>)}</select><button>조회</button>{learning.selectedExamId && <Link href="/mypage">초기화</Link>}</form></div>
        {learning.history.length ? <div className="history-list">{learning.history.map(item => { const state = status(item.status, item.passed); const active = item.status === "in_progress"; const result = item.status === "graded" || item.status === "submitted"; const href = active ? `/exams/${item.examSlug}/take` : result ? `/exams/${item.examSlug}/result?attemptId=${item.id}` : ""; return <article key={item.id}><div className="history-date"><b>{date(item.resultAt ?? item.startedAt)}</b><small>{date(item.startedAt)} 시작</small></div><div className="history-exam"><span className={`history-status ${state.className}`}>{state.label}</span><h3>{item.examTitle}</h3><p>{item.correctCount !== null ? `정답 ${item.correctCount}개 · ` : ""}응답 {item.answeredCount}개</p></div><div className="history-score">{item.totalScore !== null ? <><strong>{item.totalScore}<small>/{item.maxScore}점</small></strong><span>{item.percentage}%</span></> : <span>채점 전</span>}</div>{href ? <Link href={href}>{active ? "이어 풀기" : "결과 보기"}<ArrowRight /></Link> : <span className="no-action">종료</span>}</article>; })}</div> : <div className="history-empty"><p>조건에 맞는 응시 기록이 없습니다.</p><Link href="/exams">모의고사 시작하기</Link></div>}
        {learning.totalPages > 1 && <nav className="pagination"><Link className={learning.currentPage === 1 ? "disabled" : ""} href={pageHref(Math.max(1, learning.currentPage - 1))}>이전</Link>{Array.from({ length: learning.totalPages }, (_, index) => index + 1).map(page => <Link className={page === learning.currentPage ? "active" : ""} href={pageHref(page)} key={page}>{page}</Link>)}<Link className={learning.currentPage === learning.totalPages ? "disabled" : ""} href={pageHref(Math.min(learning.totalPages, learning.currentPage + 1))}>다음</Link></nav>}
      </section>
    </section>
  </main>;
}
