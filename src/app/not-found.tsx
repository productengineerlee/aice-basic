import Link from "next/link";
import { FileQuestion } from "lucide-react";
export default function NotFound() { return <main className="system-state not-found-state"><FileQuestion /><span>404 NOT FOUND</span><h1>요청한 페이지를 찾을 수 없습니다</h1><p>주소가 변경됐거나 삭제된 페이지입니다.</p><div><Link href="/">홈으로 이동</Link><Link href="/exams">모의고사 목록</Link></div></main>; }
