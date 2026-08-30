import Link from "next/link";
import { ArrowRight, Award, FileQuestion } from "lucide-react";
import { ExamHeader } from "@/components/exams/exam-header";
import { listCertifications } from "@/lib/certifications";
import "../exams/exams.css";
import "./license.css";

export const dynamic = "force-dynamic";

export default async function LicensePage() {
  const certifications = await listCertifications();

  return (
    <main className="exam-app">
      <ExamHeader />
      <section className="exam-container">
        <div className="exam-titlebar">
          <div><h1>자격증 문제풀이</h1></div>
          <p>무료 베타로 제공되는 자격증 기출/모의 문제풀이입니다. 문항별 정오답 데이터를 쌓아 취약영역 분석에 활용합니다.</p>
        </div>
        {certifications.length === 0 ? (
          <p className="license-empty">준비 중인 자격증이 없습니다.</p>
        ) : (
          <div className="catalog-grid">
            {certifications.map((cert) => (
              <article className="catalog-card" key={cert.code}>
                <div className="catalog-card-top"><span className="kind-pill quiz"><Award size={13} />자격증</span></div>
                <h2>{cert.name}</h2>
                {cert.description && <p className="license-card-desc">{cert.description}</p>}
                <div className="catalog-meta"><span><FileQuestion />모의문제 {cert.examCount}종</span></div>
                <Link href={`/license/${cert.code}`}>자세히 보기 <ArrowRight /></Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
