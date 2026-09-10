import Link from "next/link";
import { ArrowRight, Clock3, FileQuestion } from "lucide-react";
import { ExamHeader } from "@/components/exams/exam-header";
import { listExams } from "@/lib/exams";
import "./exams.css";

export const dynamic = "force-dynamic";

export default async function ExamsPage(){const exams=await listExams();return <main className="exam-app"><ExamHeader/><section className="exam-container"><div className="exam-titlebar"><div><h1>AICE BASIC 샘플문제</h1></div><p>분류와 회귀, 총 {exams.length}개의 실전 세트를 준비했습니다.</p></div><div className="catalog-grid">{exams.map((e,i)=><article className="catalog-card" key={e.slug}><div className="catalog-card-top"><span className={`kind-pill ${e.kind}`}>{e.kind==="classification"?"분류":"회귀"}</span><span>SET {String(i+1).padStart(2,"0")}</span></div><h2>{e.title}</h2><div className="catalog-meta"><span><Clock3/>{e.durationMinutes}분</span><span><FileQuestion/>{e.questionCount}문항</span></div><div className="section-chips">{e.sections.map(s=><span key={s.code}>{s.title} {s.count}</span>)}</div><Link href={`/exams/${e.slug}`}>자세히 보기 <ArrowRight/></Link></article>)}</div><section id="notice" className="sample-notice"><p className="copyright">해당 샘플문항의 저작권은 KT에게 있습니다.</p><h3>1. 샘플문항에 관한 안내</h3><ul><li>본 샘플 문항은 시험문제 유형 및 시험 환경을 참고할 수 있도록 제공됩니다.</li><li>샘플 문항의 내용 및 난이도는 실제 시험 문제와 다를 수 있습니다.</li><li>무단으로 복사, 복제, 판매, 재판매, 공개전재, 공개 유포를 할 경우 지식재산권 침해에 따른 법적 제재를 받을 수 있습니다.</li></ul><h3>2. 문항별 배점과 관련하여</h3><ul><li>세부 문항별 배점은 학습자가 자신의 수준을 참고할 수 있도록 KT에서 제공한 샘플 문항을 기반으로 코딩엑스에서 학습 수준 확인을 목적으로 임의 설정한 점수이며, 실제 AICE 시험의 공식 배점과는 무관합니다.</li></ul></section></section></main>}
