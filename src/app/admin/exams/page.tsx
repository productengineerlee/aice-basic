import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminExamsPage() {
  const admin = createAdminClient();
  const [{ data: exams }, { data: questions }] = await Promise.all([
    admin.from("exams").select("id,slug,title,description,kind,status,duration_minutes,passing_score,total_score,updated_at").order("created_at"),
    admin.from("questions").select("id,exam_id,is_active"),
  ]);
  return <main className="admin-content"><header className="admin-page-head"><div><span>CONTENT MANAGEMENT</span><h1>시험·문항 관리</h1><p>공개 상태와 시험 설정을 관리하고 문항·정답·해설을 수정합니다.</p></div></header><section className="admin-exam-cards">{(exams ?? []).map(exam => { const examQuestions = (questions ?? []).filter(question => question.exam_id === exam.id); return <article key={exam.id}><div className="exam-card-top"><span className={`admin-status status-${exam.status}`}>{exam.status}</span><small>{exam.kind}</small></div><h2>{exam.title}</h2><p>{exam.description}</p><dl><div><dt>문항</dt><dd>{examQuestions.filter(question => question.is_active).length}/{examQuestions.length}</dd></div><div><dt>시간</dt><dd>{exam.duration_minutes}분</dd></div><div><dt>합격</dt><dd>{exam.passing_score}/{exam.total_score}</dd></div></dl><Link href={`/admin/exams/${exam.id}`}>시험 관리 <ArrowRight /></Link></article>; })}</section></main>;
}
