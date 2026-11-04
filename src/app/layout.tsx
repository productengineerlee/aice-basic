import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "기출뱅크 | 국가자격·공무원 시험 기출문제 무료 풀이",
  description: "한국사능력검정시험, 공인중개사, 경영정보시각화능력 등 국가자격·공무원 시험 기출문제를 무료로 풀고 약점을 분석하세요.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
