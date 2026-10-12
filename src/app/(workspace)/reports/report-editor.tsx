'use client';

import { FormEvent, useEffect, useState } from 'react';
import ReportAssist from './report-assist';
import ReportComments from './report-comments';

type Report = { id: string; reportDate: string; summary: string | null; blockers: string | null; nextPlan: string | null; sourceNote: string | null; status: 'DRAFT'|'SUBMITTED' };
type ProjectChoice = { id: string; name: string };
type LinkedItem = { category: 'COMPLETED'|'IN_PROGRESS'|'BLOCKED'|'NEXT'; content: string; projectId: string | null; taskId: string | null; source: 'USER'|'AI_SUGGESTION' };
const localDate = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; };
const categories: Record<LinkedItem['category'], string> = { COMPLETED: '완료', IN_PROGRESS: '진행 중', BLOCKED: '막힘', NEXT: '다음 계획' };

export default function ReportEditor() {
  const [date, setDate] = useState(localDate);
  const [report, setReport] = useState<Report | null>(null);
  const [projects, setProjects] = useState<ProjectChoice[]>([]);
  const [items, setItems] = useState<LinkedItem[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState({ summary: '', blockers: '', nextPlan: '', sourceNote: '' });

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setMessage('');
    fetch(`/api/reports/${date}`).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '보고서를 불러오지 못했습니다.');
      if (!active) return;
      setReport(data.report);
      setFields({ summary: data.report?.summary ?? '', blockers: data.report?.blockers ?? '', nextPlan: data.report?.nextPlan ?? '', sourceNote: data.report?.sourceNote ?? '' });
      setItems((data.items ?? []).map((item: LinkedItem) => ({ category: item.category, content: item.content, projectId: item.projectId, taskId: item.taskId, source: item.source })));
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '보고서를 불러오지 못했습니다.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date]);

  useEffect(() => {
    fetch('/api/projects').then(async response => {
      const data = await response.json();
      if (response.ok) setProjects(data.projects.map((project: ProjectChoice) => ({ id: project.id, name: project.name })));
    }).catch(() => undefined);
  }, []);

  async function save(submit: boolean) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/reports/${date}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...fields, items, submit }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '보고서를 저장하지 못했습니다.');
      setReport(data.report);
      setItems((data.items ?? []).map((item: LinkedItem) => ({ category: item.category, content: item.content, projectId: item.projectId, taskId: item.taskId, source: item.source })));
      setMessage(submit ? '보고서를 제출했습니다.' : '초안을 저장했습니다.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '보고서를 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }

  function applyDraft(draft: { summary: string; blockers: string; nextPlan: string }, source: string) {
    setFields(current => ({ ...current, ...draft, sourceNote: source }));
    setMessage('제안한 내용을 검토할 수 있도록 보고서에 넣었습니다. 저장 전까지는 기록되지 않습니다.');
  }

  return <section className="module-card report-editor-card">
    <div className="module-card-head"><h2>보고 내용</h2><label className="date-picker">보고일<input type="date" value={date} onChange={event => setDate(event.target.value)}/></label></div>
    <ReportAssist onApply={applyDraft}/>
    {loading ? <p className="empty-state">보고서를 불러오는 중…</p> : <form id="report-editor" className="data-form" onSubmit={event => { event.preventDefault(); save(false); }}>
      <label>오늘 한 일<textarea name="summary" value={fields.summary} onChange={event => setFields(current => ({ ...current, summary: event.target.value }))} rows={5} maxLength={20000} placeholder="완료한 업무와 주요 결과를 적어 주세요."/></label>
      <label>진행 중 / 막힌 점<textarea name="blockers" value={fields.blockers} onChange={event => setFields(current => ({ ...current, blockers: event.target.value }))} rows={4} maxLength={20000} placeholder="진행 상황과 도움이 필요한 점을 적어 주세요."/></label>
      <label>다음 할 일<textarea name="nextPlan" value={fields.nextPlan} onChange={event => setFields(current => ({ ...current, nextPlan: event.target.value }))} rows={4} maxLength={20000} placeholder="다음 업무 계획을 적어 주세요."/></label>
      <div className="report-linked-items"><div className="linked-items-heading"><div><b>프로젝트 연결 항목</b><small>관리자는 본인이 관리하는 프로젝트에 연결된 항목만 검토할 수 있습니다.</small></div><button type="button" disabled={items.length >= 50} onClick={() => setItems(current => [...current, { category: 'COMPLETED', content: '', projectId: projects[0]?.id ?? null, taskId: null, source: 'USER' }])}>＋ 항목 추가</button></div>
        {items.map((item, index) => <div className="linked-report-item" key={`${index}-${item.projectId ?? 'none'}`}><select aria-label="보고 항목 분류" value={item.category} onChange={event => setItems(current => current.map((row, i) => i === index ? { ...row, category: event.target.value as LinkedItem['category'] } : row))}>{Object.entries(categories).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><select aria-label="연결 프로젝트" value={item.projectId ?? ''} onChange={event => setItems(current => current.map((row, i) => i === index ? { ...row, projectId: event.target.value || null, taskId: null } : row))}><option value="">프로젝트 연결 안 함</option>{projects.map(project => <option value={project.id} key={project.id}>{project.name}</option>)}</select><button type="button" aria-label="항목 제거" onClick={() => setItems(current => current.filter((_, i) => i !== index))}>제거</button><textarea aria-label={`${categories[item.category]} 내용`} value={item.content} onChange={event => setItems(current => current.map((row, i) => i === index ? { ...row, content: event.target.value } : row))} rows={2} maxLength={5000} placeholder="검토할 업무 내용을 입력하세요." required/></div>)}
      </div>
      {fields.sourceNote && <details className="source-trace"><summary>AI 제안의 원문 확인</summary><p>{fields.sourceNote}</p></details>}
      <div className="report-actions"><span>{report?.status === 'SUBMITTED' ? '제출됨' : '초안'}</span><div><button className="secondary-button" disabled={busy}>초안 저장</button><button type="button" disabled={busy} onClick={() => save(true)}>제출</button></div></div>
      {error && <p className="module-error" role="alert">{error}</p>}{message && <p className="module-success" role="status">{message}</p>}
    </form>}
    {report && <ReportComments reportDate={date}/>}
  </section>;
}
