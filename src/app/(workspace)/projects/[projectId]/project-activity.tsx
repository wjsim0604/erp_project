'use client';

import { useEffect, useState } from 'react';

type Entry = { id: string; action: string; targetType: string; createdAt: string; actorName: string | null; taskTitle: string | null };
const actionLabels: Record<string, string> = {
  'project.create': '프로젝트를 만들었습니다',
  'project.member_add': '프로젝트 멤버를 추가했습니다',
  'project.member_remove': '프로젝트 멤버를 제거했습니다',
  'task.create': '업무를 만들었습니다',
  'task.update': '업무를 수정했습니다',
  'task.archive': '업무를 보관했습니다',
  'project.document_upload': '프로젝트 문서를 올렸습니다',
  'project.document_delete': '프로젝트 문서를 제거했습니다',
};

export default function ProjectActivity({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${projectId}/activity`).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '활동 내역을 불러오지 못했습니다.');
      if (active) setEntries(data.entries);
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '활동 내역을 불러오지 못했습니다.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  return <section className="module-card project-activity">
    <div className="module-card-head"><h2>최근 활동</h2><span>최근 50건</span></div>
    {loading ? <p className="empty-state">활동 내역을 불러오는 중…</p> : error ? <p className="module-error" role="alert">{error}</p> : entries.length ? <ol className="activity-list">{entries.map(entry => <li key={entry.id}><span className="activity-marker"/><div><b>{entry.actorName || '사용자'}</b><span>{actionLabels[entry.action] ?? '활동을 기록했습니다'}{entry.taskTitle ? ` · ${entry.taskTitle}` : ''}</span><time dateTime={entry.createdAt}>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.createdAt))}</time></div></li>)}</ol> : <p className="empty-state">아직 기록된 활동이 없습니다.</p>}
  </section>;
}
