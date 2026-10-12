import ReportEditor from './report-editor';
import Link from 'next/link';
import { requireUser } from '@/server/http';
import { redirect } from 'next/navigation';
import TeamReports from './team-reports';
export default async function ReportsPage() { const { user } = await requireUser(); if (!user) redirect('/login'); return <main className="module-page"><header><div><Link href="/">← 대시보드</Link><h1>일일 업무 보고</h1><p>오늘 진행한 업무와 막힌 점, 다음 계획을 기록합니다.</p></div></header><ReportEditor/>{(user.role === 'ADMIN' || user.role === 'MANAGER') && <TeamReports role={user.role}/>}</main>; }
