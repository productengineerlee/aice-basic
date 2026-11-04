import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export async function ExamHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  return <header className="exam-header"><Link className="brand" href="/" aria-label="랜딩 페이지"><Image src="/logo-mark.png" alt="기출뱅크" width={32} height={32} className="brand-mark" /><span>기출<b>뱅크</b></span></Link><nav><Link href="/license">기출문제</Link><Link href="/qna">QnA</Link><Link href="/dashboard">내 학습</Link>{profile?.role === "admin" && <Link href="/admin">관리자 콘솔</Link>}</nav></header>;
}
