import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: { root: process.cwd() },
  async redirects() {
    return [
      // 옛 주소(aice-basic.vercel.app)로 들어오면 같은 경로·쿼리 그대로 새 주소로 영구 이동.
      // 단, 이미 발송된 가입 확인·비밀번호 재설정 메일의 /auth/callback 은 옛 도메인 쿠키(PKCE)가
      // 있어야 완료되므로 옛 주소에서 처리하게 둔다.
      {
        source: "/:path((?!auth/callback).*)",
        has: [{ type: "host", value: "aice-basic.vercel.app" }],
        destination: "https://gichulbank.vercel.app/:path",
        permanent: true,
      },
      // AICE 모의고사 시절 경로(샘플문제 목록·시험 안내·핵심이론)는 자격증 목록으로 보낸다.
      // /exams/:slug/take, /exams/:slug/result 는 자격증 시험에서도 쓰므로 그대로 둔다.
      { source: "/exams", destination: "/license", permanent: true },
      { source: "/exams/:slug", destination: "/license", permanent: true },
      { source: "/theory", destination: "/license", permanent: true },
    ];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },
};

export default nextConfig;