"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; success?: string; name?: string; email?: string };

const message = (error: unknown) => error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";

// 모듈 초기화 시 1회만 계산
const _siteUrlCandidate = process.env.NEXT_PUBLIC_SITE_URL
  ?? process.env.NEXT_PUBLIC_VERCEL_URL
  ?? process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
  ?? process.env.VERCEL_URL
  ?? "http://localhost:3000";
const SITE_URL = (_siteUrlCandidate.startsWith("http://") || _siteUrlCandidate.startsWith("https://")
  ? _siteUrlCandidate
  : `https://${_siteUrlCandidate}`
).replace(/\/+$/, "");
const siteUrl = () => SITE_URL;

const authMessage = (value: string | undefined | null) => {
  if (!value || value.trim() === "{}" || value.trim() === "") return "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  if (value === "Invalid login credentials") return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (value === "Email not confirmed") return "이메일 인증을 완료한 뒤 로그인해 주세요.";
  if (value.toLowerCase().includes("password")) return "비밀번호를 확인해 주세요. 비밀번호는 8자 이상이어야 합니다.";
  return value;
};

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const name  = String(formData.get("name")  ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password        = String(formData.get("password")        ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const terms   = formData.get("terms")   === "on";
  const privacy = formData.get("privacy") === "on";

  if (!name || !email)               return { error: "이름과 이메일을 입력해 주세요." };
  if (password.length < 8)           return { error: "비밀번호는 8자 이상이어야 합니다." };
  if (password !== confirmPassword)  return { error: "비밀번호가 일치하지 않습니다." };
  if (!terms || !privacy)            return { error: "필수 약관에 동의해 주세요." };

  let sessionCreated = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl()}/auth/callback`,
        data: {
          full_name:       name,
          terms_version:   "2026-07-12",
          privacy_version: "2026-07-12",
        },
      },
    });
    if (error) return { error: authMessage(error.message) };
    // 이미 가입된 이메일: Supabase는 에러 없이 identities를 빈 배열로 반환
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: "이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해 주세요.", email };
    }
    sessionCreated = Boolean(data.session);
  } catch (error) { return { error: message(error) }; }

  if (sessionCreated) redirect("/dashboard");
  return { success: "인증 메일을 보냈습니다. 이메일의 인증 링크를 확인해 주세요.", name, email };
}

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const email    = String(formData.get("email")    ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "이메일과 비밀번호를 입력해 주세요." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: authMessage(error.message) };
  } catch (error) { return { error: message(error) }; }
  redirect("/dashboard");
}

export async function requestPasswordReset(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "이메일을 입력해 주세요." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl()}/auth/callback?next=/auth/update-password`,
    });
    if (error) return { error: authMessage(error.message) };
    return { success: "비밀번호 재설정 링크를 이메일로 보냈습니다." };
  } catch (error) { return { error: message(error) }; }
}

export async function updatePassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const password        = String(formData.get("password")        ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (password.length < 8)          return { error: "비밀번호는 8자 이상이어야 합니다." };
  if (password !== confirmPassword)  return { error: "비밀번호가 일치하지 않습니다." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: authMessage(error.message) };
    await supabase.auth.signOut({ scope: "local" });
    return { success: "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요." };
  } catch (error) { return { error: message(error) }; }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
