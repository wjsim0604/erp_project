'use client';
import { usePathname } from 'next/navigation';
import WorkspaceSearch from './workspace-search';
import WorkspaceNotifications from './workspace-notifications';

const labels: Record<string, string> = { '/': '대시보드', '/projects': '프로젝트', '/reports': '업무 보고', '/admin/users': '직원 관리' };
export default function WorkspaceHeader({ displayName }: { displayName: string }) {
  const path = usePathname();
  const title = path.startsWith('/projects/') ? '프로젝트 업무' : labels[path] ?? '워크스페이스';
  return <header className="topbar"><div className="breadcrumbs">워크스페이스 <span>/</span> {title}</div><div className="top-actions"><WorkspaceSearch/><WorkspaceNotifications/><div className="avatar me small">{displayName.slice(0, 1)}</div></div></header>;
}
