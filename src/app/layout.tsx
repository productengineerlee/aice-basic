import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "기출뱅크 | 국가자격·공무원 시험 기출문제 무료 풀이",
  description: "한국사능력검정시험, 공인중개사, 경영정보시각화능력 등 국가자격·공무원 시험 기출문제를 무료로 풀고 약점을 분석하세요.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard: 한국어 웹서비스 표준 글꼴. 사용하는 글자만 받는 동적 서브셋 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
