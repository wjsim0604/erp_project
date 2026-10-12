import { redirect } from 'next/navigation';
import { getDataSource } from '@/server/data-source';
import { Project, ProjectMember } from '@/server/entities';
import { requireUser } from '@/server/http';
import WorkspaceHeader from './workspace-header';
import WorkspaceSidebar from './workspace-sidebar';

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user } = await requireUser();
  if (!user) redirect('/login');
  const query = (await getDataSource()).getRepository(Project).createQueryBuilder('project')
    .where('project.archivedAt IS NULL').orderBy('project.updatedAt', 'DESC').take(4);
  if (user.role !== 'ADMIN') query.innerJoin(ProjectMember, 'membership', 'membership.projectId = project.id AND membership.userId = :userId', { userId: user.id });
  const projects = await query.getMany();

  return <main className="shell">
    <WorkspaceSidebar user={user} projects={projects.map(project => ({ id: project.id, name: project.name }))}/>
    <section className="main-area">
      <WorkspaceHeader displayName={user.name || '사용자'}/>
      <div className="route-content">{children}</div>
    </section>
  </main>;
}
