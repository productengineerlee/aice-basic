import { ArrowRight, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listExams } from "@/lib/exams";
import { signOut } from "@/app/auth/actions";

const kindLabel: Record<string, string> = { classification: "분류", regression: "회귀", mixed: "복합" };
const kindColor: Record<string, string> = { classification: "blue", regression: "violet", mixed: "blue" };

export default async function Home() {
  const supabase = await createClient();
  const [{ data: { user } }, exams] = await Promise.all([
    supabase.auth.getUser(),
    listExams(),
  ]);

  return (
    <main>
      {/* ── HEADER ── */}
      <header className="site-header">
        <Link className="brand" href="/">
          <Image src="/logo-mark.png" alt="AICE LAB" width={32} height={32} className="brand-mark" priority />
          <span>AICE <b>LAB</b></span>
        </Link>
        <nav>
          <a href="#exams">샘플문제</a>
          <a href="#" className="nav-disabled">모의문제<span className="nav-soon">준비중</span></a>
          <a href="/theory">핵심이론</a>
          <a href="https://aice.study/info/aice/basic" target="_blank" rel="noopener noreferrer">AIDU설치</a>
          <Link href="/license">자격증</Link>
          <Link href="/qna">QnA</Link>
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <a className="text-button" href="/mypage">학습 분석</a>
              <a className="primary small" href="/dashboard">내 대시보드</a>
              <form action={signOut}><button type="submit" className="text-button">로그아웃</button></form>
            </>
          ) : (
            <a className="text-button" href="/auth/login">로그인</a>
          )}
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="hero">
        <div>
          <div className="eyebrow">AICE BASIC 합격을 위한 실전 연습</div>
          <h1>AIDU로 직접 풀고,<br /><em>실력은 데이터로 확인하세요.</em></h1>
          <div className="hero-actions">
            <a className="primary btn-lg" href={user ? "/exams" : "/auth/signup"}>
              {user ? "모의고사 선택하기" : "샘플문항 시작하기"} <ArrowRight size={18} />
            </a>
          </div>
          <div className="trust">
            <span><CheckCircle2 size={14} />자동저장</span>
            <span><CheckCircle2 size={14} />무료 시작</span>
            <span><CheckCircle2 size={14} />실시간 채점</span>
          </div>
        </div>
        <div className="score-card">
          <div className="score-head">
            <div><b>모의고사 결과 리포트</b><span>예시 데이터입니다</span></div>
            <span className="pass">안정적인 합격권</span>
          </div>
          <div className="score-body">
            <div className="score-main">
              <div className="ring"><span><b>86</b><small>/ 100</small></span></div>
              <div className="score-summary">
                <span>합격 기준 80점</span>
                <strong>안정적인 합격권이에요!</strong>
              </div>
            </div>
            <div className="bars">
              <div className="bar-row"><span>탐색적 데이터 분석</span><div><i style={{ width: "90%" }} /></div><b>27<small>/30</small></b></div>
              <div className="bar-row"><span>데이터 전처리</span><div><i style={{ width: "87%" }} /></div><b>26<small>/30</small></b></div>
              <div className="bar-row"><span>AI 모델링</span><div><i style={{ width: "100%" }} /></div><b>16<small>/16</small></b></div>
              <div className="bar-row"><span>모델 성능평가</span><div><i style={{ width: "71%" }} /></div><b>17<small>/24</small></b></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── same child structure as original */}
      <section id="about" className="exam-facts">
        <div><b>15</b><span>문항</span></div>
        <div><b>60</b><span>분</span></div>
        <div><b>80</b><span>점 이상 합격</span></div>
        <div><b>100%</b><span>노코딩 실기</span></div>
      </section>

      {/* ── EXAMS ── */}
      <section id="exams" className="section exam-section">
        <div className="section-heading">
          <h2>샘플 문제</h2>
          <p>분류와 회귀 유형을 골고루 연습해 보세요.</p>
        </div>
        <div className="exam-grid">
          {exams.map((exam, i) => (
            <article className="exam-card" key={exam.slug}>
              <div className="exam-top">
                <span className={`tag ${kindColor[exam.kind]}`}>{kindLabel[exam.kind]}</span>
                <span className="exam-num">SET {String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3>{exam.title}</h3>
              <div className="exam-meta">
                <span><Clock3 size={13} />{exam.durationMinutes}분</span>
                <span><ShieldCheck size={13} />{exam.questionCount}문항</span>
              </div>
              <a className="exam-card-btn" href={user ? "/exams" : "/auth/signup"}>시험 정보 보기 <ArrowRight size={14} /></a>
            </article>
          ))}
        </div>
        <div className="notice">
          <ShieldCheck size={16} />
          <div>
            <b>안내</b>
            <p>본 서비스는 AICE 공식 시험 사이트가 아닌 학습용 모의고사 서비스입니다. 표시되는 합격 여부는 모의고사 기준입니다.</p>
          </div>
        </div>
      </section>

      {/* ── COMING SOON ── */}
      <section className="section coming-soon-section">
        <div className="coming-soon-inner">
          <span className="coming-soon-badge">준비중</span>
          <h2>모의 문제</h2>
          <p>더 다양한 유형의 실전 모의고사가 곧 추가될 예정입니다.</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <div className="footer-inner">
          <div className="brand">
            <span>AICE <b>LAB</b></span>
          </div>
          <p>AIDU 실습과 함께 준비하는 AICE BASIC 모의고사</p>
          <span>© 2026 AICE LAB. Learning service.</span>
        </div>
      </footer>
    </main>
  );
}
