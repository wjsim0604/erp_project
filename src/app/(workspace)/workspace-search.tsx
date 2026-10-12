'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type Results = { projects: { id: string; name: string; status: string }[]; tasks: { id: string; title: string; status: string; projectId: string; projectName: string }[] };

export default function WorkspaceSearch() {
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results>({ projects: [], tasks: [] });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) { setResults({ projects: [], tasks: [] }); setError(''); return; }
    let active = true;
    const timer = setTimeout(() => fetch(`/api/search?q=${encodeURIComponent(value)}`).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '검색에 실패했습니다.');
      if (active) { setResults(data); setOpen(true); setError(''); }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '검색에 실패했습니다.'); }), 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  const hasResults = results.projects.length + results.tasks.length > 0;
  return <div className="workspace-search">
    <label className="sr-only" htmlFor="workspace-search-input">프로젝트와 업무 검색</label>
    <input id="workspace-search-input" value={query} onChange={event => setQuery(event.target.value)} onFocus={() => query.trim().length > 1 && setOpen(true)} placeholder="프로젝트·업무 검색" autoComplete="off" />
    {open && <div className="search-results" role="listbox">{error ? <p role="alert">{error}</p> : !hasResults ? <p>검색 결과가 없습니다.</p> : <>
      {results.projects.map(project => <Link role="option" href={`/projects/${project.id}`} key={`p-${project.id}`} onClick={() => setOpen(false)}><small>프로젝트</small><b>{project.name}</b></Link>)}
      {results.tasks.map(task => <Link role="option" href={`/projects/${task.projectId}`} key={`t-${task.id}`} onClick={() => setOpen(false)}><small>업무 · {task.projectName}</small><b>{task.title}</b></Link>)}
    </>}</div>}
  </div>;
}
