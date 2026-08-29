import { ExamHeader } from "@/components/exams/exam-header";
import { TheoryView } from "@/components/theory/theory-view";
import { listTheoryContent } from "@/lib/theory";
import "../exams/exams.css";
import "./theory.css";

export default async function TheoryPage() {
  const sections = await listTheoryContent();
  return <main className="exam-app">
    <ExamHeader />
    <section className="exam-container theory-container">
      <div className="exam-titlebar">
        <div><h1>영역별 핵심이론</h1></div>
        <p>실제 문제를 풀기 전에, 영역별로 꼭 알아야 할 개념을 먼저 확인하세요.</p>
      </div>
      <TheoryView sections={sections} />
    </section>
  </main>;
}
