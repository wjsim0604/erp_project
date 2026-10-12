import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/server/http';
import { getDashboardData } from '@/server/dashboard';

const statusLabel: Record<string, string> = { TODO: '시작 전', IN_PROGRESS: '진행 중', IN_REVIEW: '검토 대기', DONE: '완료' };
const statusTone: Record<string, string> = { TODO: 'gray', IN_PROGRESS: 'blue', IN_REVIEW: 'amber', DONE: 'green' };
const formatDate = (date: string | null, today: string) => !date ? '미정' : date === today ? '오늘' : `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

export default async function Home() {
  const { user } = await requireUser();
  if (!user) redirect('/login');
  const data = await getDashboardData(user.id, user.role);
  const todayLabel = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full', timeZone: 'Asia/Seoul' }).format(new Date());
  const displayName = user.name || '사용자';
  const projects = data.projects;

  return <div className="content">
    <div className="welcome-row"><div><div className="eyebrow">{todayLabel}</div><h1>{displayName}님, 오늘의 업무를 확인해 보세요</h1><p>마감 일정과 진행 중인 프로젝트를 한눈에 확인할 수 있습니다.</p></div><Link className="primary-button" href="/projects">＋ <span>프로젝트 보기</span></Link></div>
    <section className="summary-grid" aria-label="업무 요약">
      <article className="summary-card"><div className="summary-top"><span>내 미완료 업무</span><span className="summary-icon violet-bg">☷</span></div><div className="metric">{data.tasks.length}<span className="metric-unit">개 표시</span></div><div className="summary-note">마감일 순으로 최대 8개 표시</div></article>
      <article className="summary-card"><div className="summary-top"><span>오늘 마감</span><span className="summary-icon orange-bg">◷</span></div><div className="metric">{data.dueToday}<span className="metric-unit">개</span></div><div className="summary-note">오늘 마감되는 내 업무</div></article>
      <article className="summary-card"><div className="summary-top"><span>지연 업무</span><span className="summary-icon red-bg">↗</span></div><div className="metric">{data.overdue}<span className="metric-unit">개</span></div><div className="summary-note">마감일이 지난 미완료 업무</div></article>
      <article className="summary-card report-card"><div className="summary-top"><span>오늘 업무 보고</span><span className="summary-icon green-bg">▤</span></div><div className="report-state"><span className="report-dot"/>{data.reportSubmitted ? '오늘 보고서를 제출했어요' : '오늘 보고서가 아직 없어요'}</div><Link className="report-link" href="/reports">보고서 작성하기 <span>→</span></Link></article>
    </section>
    <div className="dashboard-grid">
      <section className="panel tasks-panel" id="tasks"><div className="panel-heading"><div><h2>내 업무</h2><p>마감일이 가까운 순서로 표시합니다</p></div><Link href="/projects" className="text-link">프로젝트 보기 <span>→</span></Link></div><div className="task-table"><div className="task-header"><span>업무</span><span>상태</span><span>마감일</span></div>{data.tasks.length ? data.tasks.slice(0, 5).map(task => <div className="task-row" key={task.id}><div className="task-info"><div className="task-info-text"><b>{task.title}</b><small>{task.projectName}</small></div></div><span className={`status ${statusTone[task.status] ?? 'gray'}`}><i/>{statusLabel[task.status] ?? task.status}</span><div className="task-due"><span className={task.dueDate && task.dueDate < data.today ? 'due-today' : ''}>{formatDate(task.dueDate, data.today)}</span></div></div>) : <div className="dashboard-empty">표시할 미완료 업무가 없습니다.</div>}</div></section>
      <section className="panel projects-panel" id="projects"><div className="panel-heading"><div><h2>진행 중인 프로젝트</h2><p>내가 접근할 수 있는 프로젝트</p></div><Link href="/projects" className="text-link">전체 보기 <span>→</span></Link></div>{projects.length ? projects.map((project, index) => <Link className="project-row dashboard-project" href={`/projects/${project.id}`} key={project.id}><div className={`project-symbol ${['violet','green','orange','violet'][index]}`}>{project.name.slice(0, 1)}</div><div className="project-detail"><b>{project.name}</b><small>{project.dueDate ? `마감 ${project.dueDate}` : '마감일 미정'}</small><div className="progress"><i style={{width:`${project.progress}%`,background:['#7164e8','#36a985','#e6a34a'][index % 3]}}/></div></div><b className="progress-number">{project.progress}%</b></Link>) : <div className="dashboard-empty">접근 가능한 프로젝트가 없습니다. 관리자에게 초대를 요청하거나 프로젝트를 만들어 주세요.</div>}</section>
      <section className="panel activity-panel"><div className="panel-heading"><div><h2>업무 보고</h2><p>매일 진행 상황과 장애물을 기록하세요</p></div></div><p className="activity-placeholder">짧은 진행 기록을 남기면 팀이 업무 현황을 공유할 수 있습니다.</p><Link href="/reports" className="report-link">오늘 보고서 작성 <span>→</span></Link></section>
      <section className="panel activity-panel"><div className="panel-heading"><div><h2>프로젝트 관리</h2><p>팀 업무를 프로젝트별로 정리합니다</p></div></div><p className="activity-placeholder">프로젝트를 만든 뒤 업무를 등록하고 담당자와 마감일을 설정하세요.</p><Link href="/projects" className="report-link">프로젝트 열기 <span>→</span></Link></section>
    </div>
    <footer className="footer"><span>Flowworks · 업무 및 프로젝트 관리</span><span>업무 진행 상황을 빠르게 확인하세요</span></footer>
  </div>;
}
