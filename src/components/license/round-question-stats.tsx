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
      <div className="round-question-list">
        {active.questions.map((question) => (
          <div className="round-question-row" key={question.number}>
            <span className="q-number">{question.number}번</span>
            <p className="q-prompt">{question.prompt}</p>
            {question.attemptCount > 0 ? (
              <>
                <div className="stat-meter"><i style={{ width: `${question.accuracy}%` }} /></div>
                <b>{question.correctCount}/{question.attemptCount}명</b>
                <span className="q-accuracy">{question.accuracy}%</span>
              </>
            ) : (
              <span className="q-no-data">응시 기록 없음</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
