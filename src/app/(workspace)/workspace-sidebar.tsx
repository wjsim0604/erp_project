'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from './actions';

type Role = 'ADMIN'|'MANAGER'|'MEMBER'|'VIEWER';
type Props = { user: { id: string; role: Role; name?: string | null }; projects: { id: string; name: string }[] };
const activeClass = (active: boolean) => `nav-item${active ? ' active' : ''}`;

export default function WorkspaceSidebar({ user, projects }: Props) {
  const path = usePathname();
  const isProjectRoute = path.startsWith('/projects');
  const isReportRoute = path.startsWith('/reports');
  const isAdminRoute = path.startsWith('/admin');
  const displayName = user.name || '사용자';

  return <aside className="sidebar">
    <Link className="brand" href="/"><span className="brand-mark">F</span><span>flow<span className="brand-light">works</span></span></Link>
    <div className="workspace"><div className="workspace-icon">W</div><div><b>워크스페이스</b><small>프로젝트 업무 관리</small></div><span className="chevron">⌄</span></div>
    <div className="nav-label">WORKSPACE</div>
    <nav className="nav-list" aria-label="주 메뉴">
      <Link className={activeClass(path === '/')} href="/" aria-current={path === '/' ? 'page' : undefined}><span className="nav-icon">▦</span>대시보드</Link>
      <Link className={activeClass(isProjectRoute)} href="/projects" aria-current={isProjectRoute ? 'page' : undefined}><span className="nav-icon">◫</span>프로젝트</Link>
      <Link className={activeClass(isReportRoute)} href="/reports" aria-current={isReportRoute ? 'page' : undefined}><span className="nav-icon">▤</span>업무 보고</Link>
      {user.role === 'ADMIN' && <Link className={activeClass(isAdminRoute)} href="/admin/users" aria-current={isAdminRoute ? 'page' : undefined}><span className="nav-icon">⚙</span>직원 관리</Link>}
      {user.role === 'ADMIN' && <Link className={activeClass(path.startsWith('/admin/security'))} href="/admin/security" aria-current={path.startsWith('/admin/security') ? 'page' : undefined}><span className="nav-icon">◈</span>관리자 보안</Link>}
    </nav>
    <div className="nav-label project-label">내 프로젝트 <Link href="/projects" aria-label="프로젝트 추가">＋</Link></div>
    {projects.map((project, index) => <Link className="project-link" href={`/projects/${project.id}`} key={project.id}><i className={`dot ${['violet','green','orange','violet'][index]}`}/>{project.name}</Link>)}
    <Link className="all-projects" href="/projects">모든 프로젝트 보기 <span>→</span></Link>
    <div className="sidebar-bottom"><div className="profile"><div className="avatar me">{displayName.slice(0, 1)}</div><div><b>{displayName}</b><small>{user.role}</small></div><form action={logoutAction}><button className="sign-out">로그아웃</button></form></div></div>
  </aside>;
}
