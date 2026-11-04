import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import "./auth.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="auth-shell"><section className="auth-panel"><Link className="brand" href="/"><Image src="/logo-mark.png" alt="기출뱅크" width={32} height={32} className="brand-mark" /><span>기출<b>뱅크</b></span></Link><div className="auth-benefits"><span>국가자격·공무원 시험 기출문제</span><h2>기출문제는 무료로 풀고<br/>약점은 데이터로 확인하세요.</h2><p>회차별 실전 풀이부터 자동채점·학습진단까지</p>{["회차별 기출문제 무료 제공","답안 자동저장 및 즉시 채점","영역·세부유형별 약점 분석"].map(x=><div key={x}><CheckCircle2/>{x}</div>)}</div></section><section className="auth-content">{children}</section></main>;
}
