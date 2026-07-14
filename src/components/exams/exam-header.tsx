import Link from "next/link";
import { BrainCircuit } from "lucide-react";
export function ExamHeader(){return <header className="exam-header"><Link className="brand" href="/" aria-label="랜딩 페이지"><span className="brand-mark"><BrainCircuit size={20}/></span><span>AICE <b>LAB</b></span></Link><nav><Link href="/exams">모의고사</Link><Link href="/dashboard">내 학습</Link></nav></header>}
