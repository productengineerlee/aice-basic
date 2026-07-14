import Link from "next/link";
import { Suspense } from "react";
import { BarChart3, BookOpenCheck, BrainCircuit, ClipboardList, LayoutDashboard, LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { requireAdmin } from "@/lib/admin-auth";
import { LoadingScreen } from "@/components/system/loading-screen";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireAdmin();
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/admin"><span><BrainCircuit size={20} /></span>AICE <b>LAB</b></Link>
      <nav>
        <Link href="/admin"><LayoutDashboard />관리자 홈</Link>
        <Link href="/admin/exams"><BookOpenCheck />시험·문항 관리</Link>
        <Link href="/admin/diagnostics"><BarChart3 />진단 규칙 관리</Link>
        <Link href="/exams"><ClipboardList />사용자 시험 화면</Link>
      </nav>
      <div className="admin-account"><span>ADMIN</span><strong>{profile.display_name || user.email?.split("@")[0]}</strong><small>{user.email}</small><form action={signOut}><button><LogOut />로그아웃</button></form></div>
    </aside>
    <div className="admin-main"><Suspense fallback={<LoadingScreen label="관리자 데이터를 불러오고 있습니다" />}>{children}</Suspense></div>
  </div>;
}
