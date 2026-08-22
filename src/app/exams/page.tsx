import Link from "next/link";
import { ArrowRight, Clock3, FileQuestion } from "lucide-react";
import { ExamHeader } from "@/components/exams/exam-header";
import { listExams } from "@/lib/exams";
import "./exams.css";

export const dynamic = "force-dynamic";

export default async function ExamsPage(){const exams=await listExams();return <main className="exam-app"><ExamHeader/><section className="exam-container"><div className="exam-titlebar"><div><h1>AICE BASIC 모의고사</h1></div><p>분류와 회귀, 총 {exams.length}개의 실전 세트를 준비했습니다.</p></div><div className="catalog-grid">{exams.map((e,i)=><article className="catalog-card" key={e.slug}><div className="catalog-card-top"><span className={`kind-pill ${e.kind}`}>{e.kind==="classification"?"분류":"회귀"}</span><span>SET {String(i+1).padStart(2,"0")}</span></div><h2>{e.title}</h2><div className="catalog-meta"><span><Clock3/>{e.durationMinutes}분</span><span><FileQuestion/>{e.questionCount}문항</span></div><div className="section-chips">{e.sections.map(s=><span key={s.code}>{s.title} {s.count}</span>)}</div><Link href={`/exams/${e.slug}`}>시험 정보 보기 <ArrowRight/></Link></article>)}</div></section></main>}
