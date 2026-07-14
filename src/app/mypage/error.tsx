"use client";
import { ErrorScreen } from "@/components/system/error-screen";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ErrorScreen error={error} reset={reset} title="학습 분석을 불러오지 못했습니다" backHref="/dashboard" backLabel="대시보드로 이동" />; }
