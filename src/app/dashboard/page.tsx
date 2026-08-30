import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import "./dashboard.css";

const statusLabel = (status: string, passed: boolean | null) => {
  if (status === "in_progress") return "진행 중";
  if (status === "expired") return "시간 종료";
  return passed ? "합격" : "불합격";
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: profile }, { data: attempts }] = await Promise.all([
    supabase.from("profiles").select("id,display_name,role").eq("id", user.id).single(),
    supabase.from("attempts").select("id,exam_id,status,started_at,updated_at,total_score,passed").order("started_at", { ascending: false }).limit(5),
  ]);
  const examIds = [...new Set((attempts ?? []).map((attempt) => attempt.exam_id))];
  const { data: exams } = examIds.length
    ? await supabase.from("exams").select("id,slug,title").in("id", examIds)
    : { data: [] };
  const examById = new Map((exams ?? []).map((exam) => [exam.id, exam]));
  const displayName = profile?.display_name || user.email?.split("@")[0] || "학습자";

  return <main className="dashboard-shell"><header><Link className="brand" href="/" aria-label="랜딩 페이지"><Image src="/logo-mark.png" alt="AICE LAB" width={32} height={32} className="brand-mark" /><span>AICE <b>LAB</b></span></Link><div className="dashboard-actions"><Link href="/mypage">학습 분석</Link>{profile?.role === "admin" && <Link href="/admin">관리자 콘솔</Link>}<form action={signOut}><button><LogOut/>로그아웃</button></form></div></header><section><span className="dashboard-kicker">MY DASHBOARD</span><h1>안녕하세요, {displayName}님</h1>{attempts?.length ? <div className="recent-attempts"><div className="recent-heading"><div><span>RECENT ATTEMPTS</span><h2>최근 응시 기록</h2></div><div className="heading-actions"><Link href="/exams">AICE 모의고사</Link><Link href="/license" className="ghost">자격증 문제풀이</Link></div></div><div className="attempt-list">{attempts.map((attempt) => { const exam = examById.get(attempt.exam_id); const active = attempt.status === "in_progress"; const scored = attempt.status === "submitted" || attempt.status === "graded"; return <article key={attempt.id}><div><span>{new Date(attempt.started_at).toLocaleDateString("ko-KR")}</span><h3>{exam?.title ?? "모의고사"}</h3></div><div className="attempt-outcome"><b className={`status-${attempt.status}`}>{statusLabel(attempt.status, attempt.passed)}</b>{attempt.total_score !== null && <strong>{attempt.total_score}점</strong>}{active ? <Link href={`/exams/${exam?.slug}/take`}>이어 풀기</Link> : scored ? <Link href={`/exams/${exam?.slug}/result?attemptId=${attempt.id}`}>결과 보기</Link> : <span className="no-action">종료</span>}</div></article> })}</div></div> : <div className="empty-dashboard"><h2>모의고사를 시작해보세요</h2><p>AICE 샘플 모의고사와 자격증 문제풀이 중 원하는 시험을 선택할 수 있습니다.</p><div className="empty-dashboard-actions"><Link className="dashboard-start" href="/exams">AICE 모의고사</Link><Link className="dashboard-start ghost" href="/license">자격증 문제풀이</Link></div></div>}</section></main>;
}