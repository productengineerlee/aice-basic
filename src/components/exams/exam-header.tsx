import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export async function ExamHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  return <header className="exam-header"><Link className="brand" href="/" aria-label="랜딩 페이지"><Image src="/logo-mark.png" alt="AICE LAB" width={32} height={32} className="brand-mark" /><span>AICE <b>LAB</b></span></Link><nav><Link href="/theory">핵심이론</Link><Link href="/exams">샘플문제</Link><span className="nav-disabled">모의문제<span className="nav-soon">준비중</span></span><Link href="/license">자격증</Link><Link href="/dashboard">내 학습</Link>{profile?.role === "admin" && <Link href="/admin">관리자 콘솔</Link>}</nav></header>;
}
