import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listCertifications } from "@/lib/certifications";

export type QnaCategory = { id: string | null; code: string; name: string };

export async function listQnaCategories(): Promise<QnaCategory[]> {
  const certs = await listCertifications();
  return [{ id: null, code: "aice-basic", name: "AICE BASIC" }, ...certs.map((c) => ({ id: c.id, code: c.code, name: c.name }))];
}

export type QnaPostSummary = {
  id: string;
  title: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  commentCount: number;
  categoryName: string;
};

const PAGE_SIZE = 20;

export async function listQnaPosts(params: { categoryId?: string | null; hasCategory?: boolean; page?: number }): Promise<{ posts: QnaPostSummary[]; total: number; pageSize: number }> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("qna_posts")
    .select("id,title,created_at,user_id,certification_id", { count: "exact" })
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (params.hasCategory) {
    query = params.categoryId === null ? query.is("certification_id", null) : query.eq("certification_id", params.categoryId as string);
  }
  const { data: posts, count, error } = await query;
  if (error) throw new Error("게시글을 불러오지 못했습니다.");
  const postRows = posts ?? [];

  const userIds = [...new Set(postRows.map((p) => p.user_id))];
  const certIds = [...new Set(postRows.map((p) => p.certification_id).filter((v): v is string => !!v))];
  const postIds = postRows.map((p) => p.id);

  const [{ data: profiles }, { data: certs }, { data: comments }] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id,display_name").in("id", userIds) : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
    certIds.length ? supabase.from("certifications").select("id,name").in("id", certIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    postIds.length ? supabase.from("qna_comments").select("post_id").in("post_id", postIds).eq("is_active", true) : Promise.resolve({ data: [] as { post_id: string }[] }),
  ]);

  const nameByUser = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? "회원"]));
  const nameByCert = new Map((certs ?? []).map((c) => [c.id, c.name]));
  const commentCountByPost = new Map<string, number>();
  for (const c of comments ?? []) commentCountByPost.set(c.post_id, (commentCountByPost.get(c.post_id) ?? 0) + 1);

  return {
    posts: postRows.map((p) => ({
      id: p.id,
      title: p.title,
      createdAt: p.created_at,
      authorId: p.user_id,
      authorName: nameByUser.get(p.user_id) ?? "회원",
      commentCount: commentCountByPost.get(p.id) ?? 0,
      categoryName: p.certification_id ? (nameByCert.get(p.certification_id) ?? "자격증") : "AICE BASIC",
    })),
    total: count ?? 0,
    pageSize: PAGE_SIZE,
  };
}

export type QnaComment = { id: string; content: string; createdAt: string; authorId: string; authorName: string };

export type QnaPostDetail = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorName: string;
  categoryCode: string;
  categoryName: string;
  comments: QnaComment[];
};

export async function getQnaPost(id: string): Promise<QnaPostDetail | null> {
  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from("qna_posts")
    .select("id,title,content,created_at,updated_at,user_id,certification_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("게시글을 불러오지 못했습니다.");
  if (!post) return null;

  const [{ data: author }, { data: cert }, { data: comments }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", post.user_id).maybeSingle(),
    post.certification_id
      ? supabase.from("certifications").select("code,name").eq("id", post.certification_id).maybeSingle()
      : Promise.resolve({ data: null as { code: string; name: string } | null }),
    supabase.from("qna_comments").select("id,content,created_at,user_id").eq("post_id", id).eq("is_active", true).order("created_at", { ascending: true }),
  ]);

  const commentRows = comments ?? [];
  const commentUserIds = [...new Set(commentRows.map((c) => c.user_id))];
  const { data: commentProfiles } = commentUserIds.length
    ? await supabase.from("profiles").select("id,display_name").in("id", commentUserIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const nameByUser = new Map((commentProfiles ?? []).map((p) => [p.id, p.display_name ?? "회원"]));

  return {
    id: post.id,
    title: post.title,
    content: post.content,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    authorId: post.user_id,
    authorName: author?.display_name ?? "회원",
    categoryCode: cert?.code ?? "aice-basic",
    categoryName: cert?.name ?? "AICE BASIC",
    comments: commentRows.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.created_at,
      authorId: c.user_id,
      authorName: nameByUser.get(c.user_id) ?? "회원",
    })),
  };
}
