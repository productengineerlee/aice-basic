"use client";
/* eslint-disable react-hooks/set-state-in-effect -- result is restored from browser storage after hydration. */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, CheckCircle2, ChevronDown, RotateCcw, XCircle } from "lucide-react";
import type { GradingResult } from "@/lib/grading";

function Radar({ values }: { values: number[] }) {
  const c = 100, r = 72, n = values.length;
  const point = (i: number, p: number) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return `${c + Math.cos(a) * r * p / 100},${c + Math.sin(a) * r * p / 100}`; };
  return <svg className="radar" viewBox="0 0 200 200">{[25, 50, 75, 100].map(v => <polygon key={v} points={values.map((_, i) => point(i, v)).join(" ")} className="radar-ring" />)}{values.map((_, i) => <line key={i} x1={c} y1={c} x2={point(i, 100).split(",")[0]} y2={point(i, 100).split(",")[1]} className="radar-axis" />)}<polygon points={values.map((v, i) => point(i, v)).join(" ")} className="radar-value" />{values.map((v, i) => { const [x, y] = point(i, v); return <circle key={i} cx={x} cy={y} r="3" className="radar-dot" />; })}</svg>;
}

function legacyComment(p: number) {
  if (p >= 80) return "안정적으로 이해하고 있습니다. 실전 시간 관리와 고난도 문항에 집중하세요.";
  if (p >= 60) return "기본기는 갖추었지만 복합 조건과 결과 해석을 조금 더 연습하세요.";
  if (p >= 40) return "핵심 개념은 일부 이해했습니다. 오답 해설과 같은 유형을 반복해 보세요.";
  return "기초 개념과 AIDU 메뉴 흐름부터 다시 익히는 것이 좋습니다.";
}
const levelLabel = { foundation: "기초 보강", weak: "집중 보강", developing: "발전 단계", strong: "강점" } as const;

export function ResultView({ slug }: { slug: string }) {
  const [result, setResult] = useState<GradingResult | null>(null);
  const [open, setOpen] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    try { const cached = localStorage.getItem(`aice-result:${slug}:latest`); if (cached) setResult(JSON.parse(cached) as GradingResult); } catch {}
    const attemptId = new URLSearchParams(window.location.search).get("attemptId");
    const query = attemptId ? `?attemptId=${encodeURIComponent(attemptId)}` : "";
    fetch(`/api/exams/${slug}/result${query}`, { cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error("result unavailable"); return response.json() as Promise<GradingResult>; })
      .then(remote => { if (cancelled) return; setResult(remote); localStorage.setItem(`aice-result:${slug}:latest`, JSON.stringify(remote)); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const sectionDiagnostics = useMemo(() => new Map(result?.diagnostics?.sections?.map(item => [item.code, item]) ?? []), [result]);
  const weakestSection = useMemo(() => result?.diagnostics?.sections ? [...result.diagnostics.sections].sort((a, b) => a.percentage - b.percentage)[0] : null, [result]);
  const weakestCompetency = result?.diagnostics?.competencies?.[0] ?? null;

  if (!result) return <main className="result-empty"><BarChart3 /><h1>{loading ? "Supabase에서 결과를 불러오는 중" : "채점 결과가 없습니다"}</h1><p>{loading ? "잠시만 기다려 주세요." : "모의고사를 제출하면 결과가 이곳에 표시됩니다."}</p><Link href={`/exams/${slug}`}>시험 안내로 돌아가기</Link></main>;

  return <main className="result-page">
    <header className={result.passed ? "pass" : "fail"}><div className="result-head-inner"><Link href="/exams"><ArrowLeft />모의고사 목록</Link><div className="result-status">{result.passed ? <CheckCircle2 /> : <XCircle />}<span>{result.passed ? "모의 합격" : "모의 불합격"}</span></div><h1>{result.examTitle}</h1><p>제출 즉시 자동채점한 결과입니다.</p><div className="total-score"><b>{result.totalScore}</b><span>/ {result.maxScore}점</span></div><div className="score-meta"><span>합격 기준 {result.passingScore}점</span><span>정답 {result.correctCount}/{result.questionCount}</span><span>응답 {result.answeredCount}/{result.questionCount}</span></div></div></header>
    <section className="result-container">
      <div className="result-grid">
        <article className="result-card"><h2>영역별 점수</h2><div className="section-bars">{result.sections.map(section => { const diagnostic = sectionDiagnostics.get(section.code); return <div key={section.code}><div><span>{section.title}</span><b>{section.earnedScore}<small> / {section.maxScore}</small></b></div><i><em style={{ width: `${section.percentage}%` }} /></i><p>{diagnostic?.comment ?? legacyComment(section.percentage)}</p>{diagnostic?.recommendation && <small className="section-recommendation">보강 방법 · {diagnostic.recommendation}</small>}</div>; })}</div></article>
        <article className="result-card radar-card"><h2>영역별 역량 균형</h2><Radar values={result.sections.map(section => section.percentage)} /><div className="radar-labels">{result.sections.map(section => <span key={section.code}>{section.title}<b>{section.percentage}%</b></span>)}</div></article>
      </div>

      {weakestSection && <article className="coach-card"><span>개인별 우선 보강</span><h2>{weakestSection.title}{weakestCompetency ? ` · ${weakestCompetency.title}` : ""}</h2><p>{weakestSection.comment}</p><strong>{weakestSection.recommendation}</strong>{weakestCompetency && <p className="competency-coach"><b>{weakestCompetency.title} {weakestCompetency.percentage}%</b> — {weakestCompetency.recommendation}</p>}</article>}

      {!!result.diagnostics?.competencies?.length && <section className="competency-section"><div className="diagnostic-heading"><span>COMPETENCY DIAGNOSIS</span><h2>세부 역량 진단</h2><p>문항에 연결된 역량 태그별 정답과 배점을 기준으로 분석했습니다.</p></div><div className="competency-grid">{result.diagnostics.competencies.map(item => <article className={`competency-card level-${item.level}`} key={item.code}><div className="competency-top"><div><span>{levelLabel[item.level]}</span><h3>{item.title}</h3></div><b>{item.percentage}<small>%</small></b></div><div className="competency-meter"><i style={{ width: `${item.percentage}%` }} /></div><small className="competency-count">정답 {item.correctCount}/{item.questionCount} · {item.earnedScore}/{item.maxScore}점</small><p>{item.comment}</p><strong>보강 방법</strong><p>{item.recommendation}</p></article>)}</div></section>}

      <div className="review-heading"><div><span>ANSWER REVIEW</span><h2>문항별 결과와 해설</h2></div><Link href={`/exams/${slug}/take`}><RotateCcw />다시 풀기</Link></div>
      <div className="review-list">{result.questions.map(question => <article className={question.isCorrect ? "correct" : "wrong"} key={question.number}><button onClick={() => setOpen(current => current.includes(question.number) ? current.filter(number => number !== question.number) : [...current, question.number])}><span className="result-icon">{question.isCorrect ? <CheckCircle2 /> : <XCircle />}</span><span className="review-title"><b>문제 {question.number}</b><small>{question.prompt}</small></span><span className="review-score">{question.awardedScore} / {question.maxScore}점</span><ChevronDown className={open.includes(question.number) ? "rotate" : ""} /></button>{open.includes(question.number) && <div className="review-detail"><div><span>내 답안</span><p>{question.userAnswerDisplay}</p></div><div><span>정답</span><p>{question.correctAnswer}</p></div><div className="explanation"><span>해설</span><p>{question.explanation}</p></div></div>}</article>)}</div>
    </section>
  </main>;
}