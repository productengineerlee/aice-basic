import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import "./auth.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="auth-shell"><section className="auth-panel"><Link className="brand" href="/"><Image src="/logo-mark.png" alt="AICE LAB" width={32} height={32} className="brand-mark" /><span>AICE <b>LAB</b></span></Link><div className="auth-benefits"><span>AICE BASIC 실전 준비</span><h2>AIDU로 직접 풀고<br/>데이터로 성장하세요.</h2><p>모의고사부터 자동채점·학습진단까지</p>{["60분 실전 모의고사","답안 자동저장 및 즉시 채점","영역·세부역량별 분석"].map(x=><div key={x}><CheckCircle2/>{x}</div>)}</div></section><section className="auth-content">{children}</section></main>;
}
