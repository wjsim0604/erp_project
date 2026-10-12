import TasksClient from './tasks-client';
import MembersClient from './members-client';
import ProjectOverview from './project-overview';
import ProjectActivity from './project-activity';
import ProjectDocuments from './project-documents';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/server/http';
import { getDataSource } from '@/server/data-source';
import { ProjectMember } from '@/server/entities';
export default async function ProjectDetailPage({ params }: { params: { projectId: string } }) { const { projectId } = params; const { user } = await requireUser(); if (!user) redirect('/login'); const membership = user.role === 'ADMIN' ? null : await (await getDataSource()).getRepository(ProjectMember).findOneBy({ projectId, userId: user.id }); const canManage = user.role === 'ADMIN' || membership?.projectRole === 'MANAGER'; return <main className="module-page"><header><div><Link href="/projects">← 프로젝트 목록</Link><h1>프로젝트 상세</h1><p>프로젝트 현황과 멤버 업무를 확인하고 관리합니다.</p></div></header><ProjectOverview projectId={projectId}/><div className="project-detail-grid"><TasksClient projectId={projectId} currentUserId={user.id} canManage={!!canManage}/><MembersClient projectId={projectId}/></div><ProjectDocuments projectId={projectId}/><ProjectActivity projectId={projectId}/></main>; }
