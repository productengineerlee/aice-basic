import { ArrowRight, CheckCircle2, FileQuestion, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSiteStats } from "@/lib/exams";
import { listCertifications } from "@/lib/certifications";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const [{ data: { user } }, certifications, siteStats] = await Promise.all([
    supabase.auth.getUser(),
    listCertifications(),
    getSiteStats(),
  ]);
  const roundCount = certifications.reduce((sum, cert) => sum + cert.examCount, 0);

  return (
    <main>
      {/* ── HEADER ── */}
      <header className="site-header">
        <Link className="brand" href="/">
          <Image src="/logo-mark.png" alt="기출뱅크" width={32} height={32} className="brand-mark" priority />
          <span>기출<b>뱅크</b></span>
        </Link>
        <nav>
          <a href="#certifications">기출문제</a>
          <Link href="/license">자격증 목록</Link>
          <Link href="/qna">QnA</Link>
        </nav>
        <div className="header-actions">
          {user ? (
            <>
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
          <div className="eyebrow">국가자격·공무원 기출문제</div>
          <h1>기출문제는 무료로,<br /><em>약점은 데이터로.</em></h1>
          <div className="hero-actions">
            <a className="primary btn-lg" href={user ? "/license" : "/auth/signup"}>
              {user ? "기출문제 풀기" : "무료로 시작하기"} <ArrowRight size={18} />
            </a>
          </div>
          <div className="trust">
            <span><CheckCircle2 size={14} />완전 무료</span>
            <span><CheckCircle2 size={14} />자동저장</span>
            <span><CheckCircle2 size={14} />즉시 채점·분석</span>
          </div>
        </div>
        <div className="score-card">
          <div className="score-head">
            <div><b>회차별 결과 리포트</b><span>예시 데이터입니다</span></div>
            <span className="pass">1급 합격권</span>
          </div>
          <div className="score-body">
            <div className="score-main">
              <div className="ring"><span><b>86</b><small>/ 100</small></span></div>
              <div className="score-summary">
                <span>한국사 심화 · 1급 80점</span>
                <strong>1급 합격권이에요!</strong>
              </div>
            </div>
            <div className="bars">
              <div className="bar-row"><span>선사·고대</span><div><i style={{ width: "92%" }} /></div><b>11<small>/12</small></b></div>
              <div className="bar-row"><span>고려</span><div><i style={{ width: "88%" }} /></div><b>7<small>/8</small></b></div>
              <div className="bar-row"><span>조선</span><div><i style={{ width: "83%" }} /></div><b>10<small>/12</small></b></div>
              <div className="bar-row"><span>근현대</span><div><i style={{ width: "72%" }} /></div><b>13<small>/18</small></b></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section id="about" className="exam-facts">
        <div><b>{certifications.length}</b><span>제공 자격증</span></div>
        <div><b>{roundCount}</b><span>기출 회차</span></div>
        <div><b>0원</b><span>이용 요금</span></div>
        <div><b>{siteStats.attemptCount.toLocaleString("ko-KR")}</b><span>누적 응시 횟수</span></div>
        <div><b>{siteStats.answeredCount.toLocaleString("ko-KR")}</b><span>누적 문제 풀이</span></div>
      </section>

      {/* ── CERTIFICATIONS ── */}
      <section id="certifications" className="section exam-section">
        <div className="section-heading">
          <h2>기출문제</h2>
          <p>시험을 고르고 회차별 기출문제를 실전처럼 풀어보세요.</p>
        </div>
        <div className="exam-grid">
          {certifications.map((cert) => (
            <article className="exam-card" key={cert.code}>
              <div className="exam-top">
                <span className="tag blue">자격증</span>
              </div>
              <h3>{cert.name}</h3>
              <div className="exam-meta">
                <span><FileQuestion size={13} />기출 {cert.examCount}회차</span>
              </div>
              <Link className="exam-card-btn" href={`/license/${cert.code}`}>회차 보기 <ArrowRight size={14} /></Link>
            </article>
          ))}
        </div>
        <div className="notice">
          <ShieldCheck size={16} />
          <div>
            <b>안내</b>
            <p>본 서비스는 각 시험의 공식 사이트가 아닌 학습용 기출문제 풀이 서비스입니다. 표시되는 합격 여부는 학습 참고용입니다.</p>
            <p>기출문제의 저작권은 각 시험 시행기관에 있습니다.</p>
          </div>
        </div>
      </section>

      {/* ── COMING SOON ── */}
      <section className="section coming-soon-section">
        <div className="coming-soon-inner">
          <span className="coming-soon-badge">준비중</span>
          <h2>더 많은 시험이 추가됩니다</h2>
          <p>국가전문자격·공무원 시험 기출문제와 맞춤형 문제 추천이 순차적으로 추가될 예정입니다.</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <div className="footer-inner">
          <div className="brand">
            <Image src="/logo-mark.png" alt="기출뱅크" width={24} height={24} className="brand-mark" />
            <span>기출<b>뱅크</b></span>
          </div>
          <p>국가자격·공무원 시험 기출문제 무료 풀이 서비스</p>
          <span>© 2026 기출뱅크. Learning service.</span>
        </div>
      </footer>
    </main>
  );
}
