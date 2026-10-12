'use client';

import { FormEvent, useState } from 'react';

type Comment = { id: string; content: string; createdAt: string; authorId: string; authorName: string };

export default function ReportComments({ reportDate, userId }: { reportDate: string; userId?: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setBusy(true);
      try {
        const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
        const response = await fetch(`/api/reports/${reportDate}/comments${query}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? '댓글을 불러오지 못했습니다.');
        setComments(data.comments);
        setLoaded(true);
        setError('');
      } catch (reason) { setError(reason instanceof Error ? reason.message : '댓글을 불러오지 못했습니다.'); }
      finally { setBusy(false); }
    }
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/reports/${reportDate}/comments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...(userId ? { userId } : {}), content }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '댓글을 저장하지 못했습니다.');
      setComments(current => [...current, data.comment]);
      setContent('');
      setLoaded(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '댓글을 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }

  return <div className="report-comments">
    <button type="button" className="comments-toggle" aria-expanded={open} onClick={toggle}>{open ? '댓글 닫기' : '검토 댓글'}{loaded ? ` (${comments.length})` : ''}</button>
    {open && <div className="comments-panel">{busy && !loaded ? <p className="empty-state">댓글을 불러오는 중…</p> : comments.length ? comments.map(comment => <article className="report-comment" key={comment.id}><b>{comment.authorName}</b><p>{comment.content}</p><time>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(comment.createdAt))}</time></article>) : <p className="empty-state">아직 댓글이 없습니다.</p>}{error && <p className="module-error" role="alert">{error}</p>}<form onSubmit={add}><label className="sr-only" htmlFor={`comment-${userId ?? reportDate}`}>검토 댓글 입력</label><textarea id={`comment-${userId ?? reportDate}`} value={content} onChange={event => setContent(event.target.value)} maxLength={5000} rows={2} placeholder="보고서 검토 의견을 남겨 주세요." required/><button disabled={busy || !content.trim()}>{busy ? '저장 중…' : '댓글 등록'}</button></form></div>}
  </div>;
}
