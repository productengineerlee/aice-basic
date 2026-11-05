import { HomeHeader } from "@/components/home/home-parts";
import { createClient } from "@/lib/supabase/server";

/** 메인과 같은 상단 메뉴. 로그인·관리자 여부만 조회해 HomeHeader에 넘긴다. */
export async function ExamHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  return <HomeHeader loggedIn={Boolean(user)} isAdmin={profile?.role === "admin"} />;
}
