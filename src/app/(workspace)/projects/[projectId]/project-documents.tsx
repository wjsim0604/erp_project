'use client';

import { FormEvent, useEffect, useState } from 'react';

type DocumentRow = { id: string; originalName: string; mimeType: string; fileSize: number; createdAt: string; uploaderName: string };
const formatSize = (size: number) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;

export default function ProjectDocuments({ projectId }: { projectId: string }) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [canUpload, setCanUpload] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    const response = await fetch(`/api/projects/${projectId}/documents`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? '문서 목록을 불러오지 못했습니다.');
    setDocuments(data.documents);
    setCanUpload(data.canUpload);
    setCanManage(data.canManage);
  }

  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${projectId}/documents`).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '문서 목록을 불러오지 못했습니다.');
      if (active) { setDocuments(data.documents); setCanUpload(data.canUpload); setCanManage(data.canManage); }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '문서 목록을 불러오지 못했습니다.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    const formElement = event.currentTarget;
    try {
      const response = await fetch(`/api/projects/${projectId}/documents`, { method: 'POST', body: new FormData(formElement) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '파일을 올리지 못했습니다.');
      formElement.reset();
      await refresh();
      setMessage('문서를 올렸습니다.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '파일을 올리지 못했습니다.'); }
    finally { setBusy(false); }
  }

  async function remove(document: DocumentRow) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/projects/${projectId}/documents/${document.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '문서를 제거하지 못했습니다.');
      setDocuments(current => current.filter(item => item.id !== document.id));
      setMessage('문서를 제거했습니다.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '문서를 제거하지 못했습니다.'); }
    finally { setBusy(false); }
  }

  return <section className="module-card project-documents">
    <div className="module-card-head"><h2>프로젝트 문서</h2><span>{documents.length}개 · 파일당 10MB 이하</span></div>
    {error && <p className="module-error" role="alert">{error}</p>}{message && <p className="module-success" role="status">{message}</p>}
    {loading ? <p className="empty-state">문서 목록을 불러오는 중…</p> : documents.length ? <ul className="document-list">{documents.map(document => <li key={document.id}><div><b>{document.originalName}</b><small>{document.uploaderName} · {formatSize(document.fileSize)} · {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(document.createdAt))}</small></div>{['application/pdf', 'image/png', 'image/jpeg'].includes(document.mimeType) && <a href={`/api/projects/${projectId}/documents/${document.id}?preview=1`} target="_blank" rel="noreferrer">미리보기</a>}<a href={`/api/projects/${projectId}/documents/${document.id}`}>다운로드</a>{canManage && <button type="button" disabled={busy} onClick={() => remove(document)}>삭제</button>}</li>)}</ul> : <p className="empty-state">등록된 문서가 없습니다.</p>}
    {canUpload && <form className="document-upload" onSubmit={upload}><label>파일 선택<input name="file" type="file" accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.docx,.xlsx,.pptx" required disabled={busy}/></label><small>PDF, TXT, CSV, PNG, JPG, DOCX, XLSX, PPTX · 최대 10MB</small><button disabled={busy}>{busy ? '처리 중…' : '문서 올리기'}</button></form>}
  </section>;
}
