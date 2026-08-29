import Link from "next/link";
import { Plus, Save, Trash2 } from "lucide-react";
import { createTheoryContentAction, deleteTheoryContentAction, updateTheoryContentAction } from "@/app/admin/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { TheoryBodyField } from "@/components/theory/theory-body-field";

export default async function AdminTheoryPage({ searchParams }: { searchParams: Promise<{ scope?: string; tag?: string; saved?: string; error?: string }> }) {
  const query = await searchParams;
  const scope = query.scope === "topic" ? "topic" : "overview";
  const admin = createAdminClient();
  const [{ data: items }, { data: sections }, { data: questions }] = await Promise.all([
    admin.from("theory_content").select("*").order("sort_order"),
    admin.from("exam_sections").select("code,title").order("sort_order"),
    admin.from("questions").select("competency_tags").eq("is_active", true),
  ]);
  const uniqueSections = [...new Map((sections ?? []).map(section => [section.code, section])).values()];
  const tags = [...new Set((questions ?? []).flatMap(question => question.competency_tags))].sort((a, b) => a.localeCompare(b, "ko"));
  const selectedTag = tags.includes(query.tag ?? "") ? query.tag! : tags[0] ?? "";
  const visibleItems = (items ?? []).filter(item => scope === "overview" ? !item.competency_tag : item.competency_tag === selectedTag);
  const returnTo = scope === "topic" ? `/admin/theory?scope=topic&tag=${encodeURIComponent(selectedTag)}` : "/admin/theory?scope=overview";
  const sectionTitle = new Map(uniqueSections.map(section => [section.code, section.title]));

  return <main className="admin-content">
    <header className="admin-page-head"><div><span>CORE THEORY</span><h1>핵심이론 관리</h1><p>학생이 시험 전에 읽는 영역별 핵심이론 콘텐츠를 관리합니다.</p></div></header>
    {query.saved && <div className="admin-message success">{query.saved}</div>}{query.error && <div className="admin-message error">{query.error}</div>}
    <nav className="diagnostic-tabs"><Link className={scope === "overview" ? "active" : ""} href="/admin/theory?scope=overview">영역 개요</Link><Link className={scope === "topic" ? "active" : ""} href={`/admin/theory?scope=topic&tag=${encodeURIComponent(selectedTag)}`}>세부 이론</Link></nav>
    {scope === "topic" && <div className="tag-filter">{tags.map(tag => <Link className={tag === selectedTag ? "active" : ""} href={`/admin/theory?scope=topic&tag=${encodeURIComponent(tag)}`} key={tag}>{tag}</Link>)}</div>}
    <section className="rules-heading"><div><h2>{scope === "overview" ? "영역 개요" : `${selectedTag} 세부 이론`}</h2><p>{scope === "overview" ? "학생이 해당 영역 탭을 열었을 때 맨 위에 표시되는 소개 문단입니다." : "해당 역량 탭에서 아코디언 항목으로 표시됩니다."}</p></div><span>{visibleItems.length}개</span></section>
    <div className="rule-list">{visibleItems.map(item => <article className="rule-card" key={item.id}>
      <form action={updateTheoryContentAction} className="rule-edit-form">
        <input type="hidden" name="id" value={item.id} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="competencyTag" value={item.competency_tag ?? ""} />
        <div className="rule-card-head"><div><span>{item.section_code ? sectionTitle.get(item.section_code) ?? item.section_code : ""}</span><h3>{item.title}</h3></div><label className="switch-label"><input type="checkbox" name="isActive" defaultChecked={item.is_active} /><span>공개</span></label></div>
        <div className="form-grid two"><label><span>영역</span><select name="sectionCode" defaultValue={item.section_code}>{uniqueSections.map(section => <option value={section.code} key={section.code}>{section.title}</option>)}</select></label><label><span>정렬 순서</span><input type="number" name="sortOrder" defaultValue={item.sort_order} /></label></div>
        <label><span>제목</span><input type="text" name="title" defaultValue={item.title} required /></label>
        <label><span>본문</span><TheoryBodyField name="body" defaultValue={item.body} required /></label>
        <button className="admin-secondary"><Save />저장</button>
      </form>
      <form action={deleteTheoryContentAction} className="rule-delete-form"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="returnTo" value={returnTo} /><button title="삭제"><Trash2 />삭제</button></form>
    </article>)}</div>

    <details className="admin-panel new-rule"><summary><Plus />새 이론 콘텐츠 추가</summary><form action={createTheoryContentAction} className="admin-form"><input type="hidden" name="returnTo" value={returnTo} />
      <div className="form-grid two"><label><span>영역</span><select name="sectionCode" defaultValue={uniqueSections[0]?.code}>{uniqueSections.map(section => <option value={section.code} key={section.code}>{section.title}</option>)}</select></label><label><span>역량 태그 (비우면 영역 개요)</span><input type="text" name="competencyTag" list="theory-tags" defaultValue={scope === "topic" ? selectedTag : ""} placeholder="예: 기초통계" /><datalist id="theory-tags">{tags.map(tag => <option value={tag} key={tag} />)}</datalist></label></div>
      <div className="form-grid two"><label><span>제목</span><input type="text" name="title" required /></label><label><span>정렬 순서</span><input type="number" name="sortOrder" defaultValue="0" /></label></div>
      <label><span>본문</span><TheoryBodyField name="body" required /></label>
      <label className="check-row"><input type="checkbox" name="isActive" defaultChecked /><span>추가 즉시 공개합니다.</span></label>
      <button className="admin-primary"><Plus />이론 추가</button>
    </form></details>
  </main>;
}
