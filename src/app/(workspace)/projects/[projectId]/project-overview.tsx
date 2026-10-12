'use client';

import { useEffect, useState } from 'react';

type Project = { name: string; description: string | null; status: string; startDate: string | null; dueDate: string | null; ownerId: string };

const statusLabels: Record<string, string> = { PLANNING: '계획 중', ACTIVE: '진행 중', ON_HOLD: '보류', COMPLETED: '완료' };

export default function ProjectOverview({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${projectId}`).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '프로젝트 정보를 불러오지 못했습니다.');
      if (active) { setProject(data.project); setProgress(data.progress); }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '프로젝트 정보를 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, [projectId]);

  if (error) return <p className="module-error" role="alert">{error}</p>;
  if (!project) return <p className="empty-state" aria-live="polite">프로젝트 정보를 불러오는 중…</p>;
  return <section className="module-card project-overview">
    <div className="module-card-head"><h2>{project.name}</h2><span className="entity-state">{statusLabels[project.status] ?? project.status}</span></div>
    <p>{project.description || '프로젝트 설명이 없습니다.'}</p>
    <div className="project-overview-meta"><span>시작일 {project.startDate || '미정'}</span><span>마감일 {project.dueDate || '미정'}</span><span>완료율 {progress}%</span></div>
  </section>;
}
