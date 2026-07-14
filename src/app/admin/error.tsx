"use client";
import { ErrorScreen } from "@/components/system/error-screen";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ErrorScreen error={error} reset={reset} title="관리자 화면을 불러오지 못했습니다" backHref="/admin" backLabel="관리자 홈으로 이동" />; }
