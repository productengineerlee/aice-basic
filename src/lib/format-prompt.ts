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
