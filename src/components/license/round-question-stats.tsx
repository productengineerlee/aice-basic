"use client";

import { useState } from "react";
import type { RoundStat } from "@/lib/license-stats";

function roundLabel(examTitle: string) {
  const match = examTitle.match(/제(\d+)회/);
  return match ? `${match[1]}회` : examTitle;
}

export function RoundQuestionStats({ rounds }: { rounds: RoundStat[] }) {
  const [activeSlug, setActiveSlug] = useState(rounds[0]?.examSlug ?? "");
  const active = rounds.find((round) => round.examSlug === activeSlug) ?? rounds[0];
  if (!active) return null;

  return (
    <div className="round-stats">
      <div className="round-tabs">
        {rounds.map((round) => (
          <button
            key={round.examSlug}
            type="button"
            className={round.examSlug === active.examSlug ? "active" : ""}
            onClick={() => setActiveSlug(round.examSlug)}
          >
            {roundLabel(round.examTitle)}
          </button>
        ))}
      </div>
      <div className="round-question-chart">
        {active.questions.map((question) => {
          const tooltip = question.attemptCount > 0
            ? `${question.number}번 · ${question.correctCount}/${question.attemptCount}명 정답 (${question.accuracy}%)\n${question.prompt}`
            : `${question.number}번 · 응시 기록 없음\n${question.prompt}`;
          return (
            <div className="chart-bar" key={question.number} data-tooltip={tooltip} title={tooltip}>
              <i className={question.attemptCount === 0 ? "no-data" : ""} style={question.attemptCount > 0 ? { height: `${Math.max(question.accuracy, 3)}%` } : undefined} />
            </div>
          );
        })}
      </div>
      <div className="chart-legend"><span><i className="legend-dot" />정답률</span><span><i className="legend-dot no-data" />응시 기록 없음</span><small>막대에 마우스를 올리면 문항 번호와 정답자 수를 볼 수 있어요.</small></div>
    </div>
  );
}
