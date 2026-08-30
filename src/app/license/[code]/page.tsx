import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarClock, ChevronDown, Clock3, FileQuestion } from "lucide-react";
import { ExamHeader } from "@/components/exams/exam-header";
import { getCertification } from "@/lib/certifications";
import { getCertificationStats, getWrongAnswerNotebook } from "@/lib/license-stats";
import { createClient } from "@/lib/supabase/server";
import "../../exams/exams.css";
import "../license.css";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "미정";
  return new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default async function LicenseDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cert = await getCertification(code);
  if (!cert) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [stats, wrongAnswers] = await Promise.all([
    getCertificationStats(cert.id),
    user ? getWrongAnswerNotebook(user.id, cert.id) : Promise.resolve([]),
  ]);

  return (
    <main className="exam-app">
      <ExamHeader />
      <section className="license-shell">
        <Link className="license-back" href="/license"><ArrowLeft size={15} />목록으로</Link>

        <div className="license-hero">
          <span className="kind-pill quiz">자격증 문제풀이</span>
          <h1>{cert.name}</h1>
          {cert.description && <p>{cert.description}</p>}
          <div className="license-hero-meta">
            <span>누적 응시 데이터 {stats.attemptCount.toLocaleString()}건</span>
            <span>문항 {stats.questionCount}개</span>
          </div>
        </div>

        <section className="license-section">
          <div className="license-section-head"><h2><CalendarClock size={17} style={{ verticalAlign: "-3px", marginRight: 6 }} />시험 일정</h2></div>
          {cert.schedules.length === 0 ? (
            <p className="schedule-empty">등록된 시험 일정이 없습니다.</p>
          ) : (
            <div className="schedule-table">
              <div className="schedule-row head"><span>회차</span><span>시험일</span><span>접수기간</span><span>비고</span></div>
              {cert.schedules.map((schedule) => (
                <div className="schedule-row" key={schedule.id}>
                  <span>{schedule.roundName}</span>
                  <span>{formatDate(schedule.examDate)}</span>
                  <span>{schedule.applyStart && schedule.applyEnd ? `${formatDate(schedule.applyStart)} ~ ${formatDate(schedule.applyEnd)}` : "미정"}</span>
                  <span>{schedule.notes ?? "-"}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {stats.sectionStats.length > 0 && (
          <section className="license-section">
            <div className="license-section-head"><h2>출제범위별 전체 통계</h2><p>지금까지 총 <b className="respondent-count">{stats.respondentCount.toLocaleString()}명</b> 응시자들의 정답률 통계데이터입니다.</p></div>
            <div className="section-bars">
              {stats.sectionStats.map((section) => (
                <div key={section.code}>
                  <b>{section.accuracy}<small>%</small></b>
                  <div className="bar-track"><i style={section.accuracy > 0 ? { height: `${Math.max(section.accuracy, 4)}%` } : { height: 0 }} /></div>
                  <span>{section.title}<small>{section.questionCount}문항</small></span>
                </div>
              ))}
            </div>
          </section>
        )}

        {stats.tagStats.length > 0 && (
          <details className="license-accordion">
            <summary><div className="license-section-head"><h2>세부항목별 정답률</h2></div><ChevronDown /></summary>
            <div className="accordion-body">
              {stats.sectionStats.map((section) => {
                const items = stats.tagStats.filter((tag) => tag.sectionCode === section.code);
                if (!items.length) return null;
                return (
                  <div className="stat-group" key={section.code}>
                    <h3>{section.title}</h3>
                    <div className="tag-stat-list">
                      {items.map((tag) => (
                        <div className="tag-stat-row" key={tag.tag}>
                          <span>{tag.tag}</span>
                          <div className="stat-meter"><i style={{ width: `${tag.accuracy}%` }} /></div>
                          <b>{tag.accuracy}%</b>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {stats.hardestQuestions.length > 0 && (
          <details className="license-accordion">
            <summary><div className="license-section-head"><h2>가장 많이 틀린 문항</h2></div><ChevronDown /></summary>
            <div className="accordion-body">
              {stats.sectionStats.map((section) => {
                const items = stats.hardestQuestions.filter((question) => question.sectionCode === section.code);
                if (!items.length) return null;
                return (
                  <div className="stat-group" key={section.code}>
                    <h3>{section.title}</h3>
                    <div className="hardest-list">
                      {items.map((question) => (
                        <div className="hardest-row" key={question.questionId}>
                          <p>{question.prompt}<small>{question.examTitle} · {question.number}번 · 응시 {question.attemptCount}회</small></p>
                          <b>{question.accuracy}%</b>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        <section className="license-section">
          <div className="license-section-head"><h2>문제풀이 시작</h2></div>
          <div className="license-exam-grid">
            {cert.exams.map((exam) => (
              <article className="license-exam-card" key={exam.slug}>
                <h3>{exam.title}</h3>
                <div className="catalog-meta"><span><Clock3 />{exam.durationMinutes}분</span><span><FileQuestion />{exam.questionCount}문항</span></div>
                <Link href={`/exams/${exam.slug}/take`}>시험 시작 <ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
        </section>

        {user && wrongAnswers.length > 0 && (
          <details className="license-accordion">
            <summary><div className="license-section-head"><h2>내 오답노트</h2><p>과목별로 묶어 최근 응시에서 틀린 문항 {wrongAnswers.length}개를 보여줍니다.</p></div><ChevronDown /></summary>
            <div className="accordion-body">
              {stats.sectionStats.map((section) => {
                const items = wrongAnswers.filter((item) => item.sectionCode === section.code);
                if (!items.length) return null;
                return (
                  <div className="stat-group" key={section.code}>
                    <h3>{section.title}</h3>
                    <div className="notebook-list">
                      {items.map((item, index) => (
                        <article className="notebook-card" key={`${item.attemptId}-${item.number}-${index}`}>
                          <p>{item.number}. {item.prompt}</p>
                          <div className="notebook-meta">
                            <span className="wrong">내 답 {item.selectedLabel ? `${item.selectedLabel}번` : "미응답"}</span>
                            <span className="correct">정답 {item.correctLabel ? `${item.correctLabel}번` : "-"}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </section>
    </main>
  );
}
