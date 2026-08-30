"use client";

import Link from "next/link";
import { useActionState, useState, useEffect } from "react";
import type { AuthState } from "@/app/auth/actions";

type Mode = "login" | "signup" | "forgot" | "update";
type Props = { mode: Mode; action: (state: AuthState, data: FormData) => Promise<AuthState>; next?: string };

const copy = {
  login:  { title: "다시 만나서 반가워요",   sub: "학습을 이어가려면 로그인하세요.",        button: "로그인" },
  signup: { title: "AICE LAB 시작하기",      sub: "무료 계정을 만들고 모의고사를 시작하세요.", button: "회원가입" },
  forgot: { title: "비밀번호 찾기",           sub: "가입한 이메일로 재설정 링크를 보내드려요.", button: "재설정 링크 받기" },
  update: { title: "새 비밀번호 설정",        sub: "앞으로 사용할 비밀번호를 입력하세요.",    button: "비밀번호 변경" },
};

export function AuthForm({ mode, action, next }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [emailVal, setEmailVal] = useState("");

  // 서버 액션이 email을 돌려줄 때 입력칸에 복원
  useEffect(() => {
    if (state.email !== undefined) setEmailVal(state.email);
  }, [state.email]);

  const passwordNeeded = mode === "login" || mode === "signup" || mode === "update";
  const emailNeeded    = mode !== "update";

  return (
    <div className="auth-card">
      <div className="auth-heading">
        <h1>{copy[mode].title}</h1>
        <p>{copy[mode].sub}</p>
      </div>
      <form action={formAction} className="auth-form">
        {next && <input type="hidden" name="next" value={next} />}

        {/* 이메일 */}
        {emailNeeded && (
          <label>
            이메일
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={emailVal}
              onChange={e => setEmailVal(e.target.value)}
              required
            />
          </label>
        )}

        {/* 비밀번호 */}
        {passwordNeeded && (
          <label>
            {mode === "update" ? "새 비밀번호" : "비밀번호"}
            <input
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="8자 이상 입력"
              minLength={8}
              required
            />
          </label>
        )}

        {/* 비밀번호 확인 */}
        {(mode === "signup" || mode === "update") && (
          <label>
            비밀번호 확인
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="비밀번호 다시 입력"
              minLength={8}
              required
            />
          </label>
        )}

        {/* 약관 동의 */}
        {mode === "signup" && (
          <div className="agreements">
            <label>
              <input name="agree" type="checkbox" required />
              <span>
                <b>[필수]</b> <Link href="/terms" target="_blank">이용약관</Link> 및{" "}
                <Link href="/privacy" target="_blank">개인정보 처리방침</Link>에 동의합니다.
              </span>
            </label>
          </div>
        )}

        {typeof state.error   === "string" && state.error   && <p className="form-message error"   role="alert">{state.error}</p>}
        {typeof state.success === "string" && state.success && <p className="form-message success" role="status">{state.success}</p>}

        <button className="auth-submit" disabled={pending}>
          {pending ? "처리 중..." : copy[mode].button}
        </button>
      </form>

      {mode === "login"  && <div className="auth-links"><Link href="/auth/forgot-password">비밀번호를 잊으셨나요?</Link><p>아직 계정이 없나요? <Link href="/auth/signup">회원가입</Link></p></div>}
      {mode === "signup" && <div className="auth-links"><p>이미 계정이 있나요? <Link href="/auth/login">로그인</Link></p></div>}
      {(mode === "forgot" || mode === "update") && <div className="auth-links"><Link href="/auth/login">로그인으로 돌아가기</Link></div>}
    </div>
  );
}
