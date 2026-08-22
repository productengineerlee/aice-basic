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

  const [{ data: profile }, { count: consentCount }, { data: attempts }] = await Promise.all([
    supabase.from("profiles").select("id,display_name,role").eq("id", user.id).single(),
    supabase.from("user_consents").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("accepted", true),
    supabase.from("attempts").select("id,exam_id,status,started_at,updated_at,total_score,passed").order("started_at", { ascending: false }).limit(5),
  ]);
  const examIds = [...new Set((attempts ?? []).map((attempt) => attempt.exam_id))];
  const { data: exams } = examIds.length
    ? await supabase.from("exams").select("id,slug,title").in("id", examIds)
    : { data: [] };
  const examById = new Map((exams ?? []).map((exam) => [exam.id, exam]));
  const displayName = profile?.display_name || user.email?.split("@")[0] || "학습자";

  return <main className="dashboard-shell"><header><Link className="brand" href="/" aria-label="랜딩 페이지"><Image src="/logo-mark.png" alt="AICE LAB" width={32} height={32} className="brand-mark" /><span>AICE <b>LAB</b></span></Link><div className="dashboard-actions"><Link href="/mypage">학습 분석</Link>{profile?.role === "admin" && <Link href="/admin">관리자 콘솔</Link>}<form action={signOut}><button><LogOut/>로그아웃</button></form></div></header><section><span className="dashboard-kicker">MY DASHBOARD</span><h1>안녕하세요, {displayName}님</h1><p>Supabase 계정과 학습자 프로필이 안전하게 연결되어 있습니다.</p><div className="account-grid"><article><span>회원 이메일</span><strong>{user.email}</strong></article><article><span>프로필</span><strong>{profile ? "연결 완료" : "확인 필요"}</strong></article><article><span>필수 동의</span><strong>{consentCount ?? 0}/2 완료</strong></article></div>{attempts?.length ? <div className="recent-attempts"><div className="recent-heading"><div><span>RECENT ATTEMPTS</span><h2>최근 응시 기록</h2></div><Link href="/exams">새 모의고사</Link></div><div className="attempt-list">{attempts.map((attempt) => { const exam = examById.get(attempt.exam_id); const active = attempt.status === "in_progress"; const href = active ? `/exams/${exam?.slug}/take` : `/exams/${exam?.slug}/result?attemptId=${attempt.id}`; return <article key={attempt.id}><div><span>{new Date(attempt.started_at).toLocaleDateString("ko-KR")}</span><h3>{exam?.title ?? "모의고사"}</h3></div><div className="attempt-outcome"><b className={`status-${attempt.status}`}>{statusLabel(attempt.status, attempt.passed)}</b>{attempt.total_score !== null && <strong>{attempt.total_score}점</strong>}<Link href={href}>{active ? "이어 풀기" : "결과 보기"}</Link></div></article> })}</div></div> : <div className="empty-dashboard"><h2>샘플 모의고사 6세트가 준비됐어요</h2><p>분류 3세트와 회귀 3세트 중 원하는 시험을 선택해 시작할 수 있습니다.</p><Link className="dashboard-start" href="/exams">모의고사 선택하기</Link></div>}</section></main>;
}