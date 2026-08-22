export function WhaleIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 꼬리 위 지느러미 */}
      <path d="M4 8 L7.5 12" />
      {/* 꼬리 아래 지느러미 */}
      <path d="M4 16 L7.5 12" />
      {/* 몸통 */}
      <path d="M7.5 12 C7.5 8.5 10 7 13 7 C17 7 21 9 21 12 C21 15 17 17 13 17 C10 17 7.5 15.5 7.5 12 Z" />
      {/* 물 뿜기 */}
      <path d="M13 7 Q13.5 4 15.5 5.5" />
      {/* 눈 */}
      <circle cx="17.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      {/* 웃음 */}
      <path d="M15 14.5 Q17 16.5 19.5 14.5" />
    </svg>
  );
}
