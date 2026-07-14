"use client";
import { ErrorScreen } from "@/components/system/error-screen";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ErrorScreen error={error} reset={reset} title="시험 정보를 불러오지 못했습니다" backHref="/exams" backLabel="시험 목록으로 이동" />; }
