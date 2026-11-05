/** 기출 지문의 o/ㅇ/○/- 글머리표를 줄바꿈으로 정리한다. 응시 화면·오답노트에서 함께 쓴다. */
export function formatPrompt(prompt: string) {
  const bulletPattern = /(\S)\s+([oOㅇ○])\s+/g;
  if (bulletPattern.test(prompt)) {
    let isFirstItem = true;
    return prompt.replace(bulletPattern, (_, prev: string) => {
      const separator = isFirstItem ? "\n\n" : "\n";
      isFirstItem = false;
      return `${prev}${separator}ㅇ `;
    });
  }
  // Some prompts use "-" as the bullet marker instead of o/O/ㅇ/○.
  let isFirstDash = true;
  return prompt.replace(/(\S)\s+-\s*(?=\S)/g, (_, prev: string) => {
    const separator = isFirstDash ? "\n\n" : "\n";
    isFirstDash = false;
    return `${prev}${separator}ㅇ `;
  });
}

/** 해설 데이터는 "정답 ④" 줄로 시작한다(검수용). 화면에는 정답이 따로 보이므로 그 줄은 빼고 보여준다. */
export function formatExplanation(explanation: string | null | undefined) {
  const text = explanation?.trim();
  if (!text) return null;
  return text.replace(/^정답\s*[①②③④⑤]\s*\n+/, "").trim() || null;
}

export const AI_EXPLANATION_NOTE = "AI가 작성한 해설입니다. 틀린 내용이 보이면 QnA로 알려 주세요.";
