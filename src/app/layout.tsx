import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AICE LAB | AICE BASIC 모의고사",
  description: "AIDU 실습과 함께 준비하는 AICE BASIC 모의고사 플랫폼",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
