import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExamHeader } from "@/components/exams/exam-header";
import { createClient } from "@/lib/supabase/server";
import { getQnaPost } from "@/lib/qna";
import { createQnaCommentAction, deleteQnaCommentAction, deleteQnaPostAction } from "../actions";
import "../../exams/exams.css";
import "../qna.css";

export const dynamic = "force-dynamic";

export default async function QnaDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/qna/${id}`);

  const [{ data: profile }, post, { error }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    getQnaPost(id),
    searchParams,
  ]);
  if (!post) notFound();

  const isAdmin = profile?.role === "admin";
  const isOwner = post.authorId === user.id;

  return (
    <main className="exam-app">
      <ExamHeader />
      <section className="exam-container qna-detail-container">
        <Link href="/qna" className="qna-back">← 목록으로</Link>
        {error && <p className="qna-error">{error}</p>}
        <article className="qna-post">
          <span className="qna-cat">{post.categoryName}</span>
          <h1>{post.title}</h1>
          <div className="qna-meta"><span>{post.authorName}</span><span>{new Date(post.createdAt).toLocaleString("ko-KR")}</span></div>
          <p className="qna-content">{post.content}</p>
          {(isOwner || isAdmin) && (
            <div className="qna-post-actions">
              {isOwner && <Link href={`/qna/${post.id}/edit`}>수정</Link>}
              <form action={deleteQnaPostAction}>
                <input type="hidden" name="id" value={post.id} />
                <button type="submit">삭제</button>
              </form>
            </div>
          )}
        </article>

        <section className="qna-comments">
          <h2>답변 {post.comments.length}개</h2>
          {post.comments.length > 0 && (
            <ul>
              {post.comments.map((comment) => (
                <li key={comment.id}>
                  <div className="qna-meta"><span>{comment.authorName}</span><span>{new Date(comment.createdAt).toLocaleString("ko-KR")}</span></div>
                  <p>{comment.content}</p>
                  {(isAdmin || comment.authorId === user.id) && (
                    <form action={deleteQnaCommentAction}>
                      <input type="hidden" name="id" value={comment.id} />
                      <input type="hidden" name="postId" value={post.id} />
                      <button type="submit">삭제</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form action={createQnaCommentAction} className="qna-comment-form">
            <input type="hidden" name="postId" value={post.id} />
            <textarea name="content" required rows={4} placeholder="답변을 입력하세요" />
            <button type="submit">답변 등록</button>
          </form>
        </section>
      </section>
    </main>
  );
}
