import { NextRequest, NextResponse } from 'next/server';
import { IsNull } from 'typeorm';
import { getDataSource } from '@/server/data-source';
import { Project, ProjectMember, Task } from '@/server/entities';
import { jsonError, requireUser } from '@/server/http';

type Context = { params: { projectId: string } };

export async function GET(_request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser();
  if (response) return response;
  try {
    const db = await getDataSource();
    const project = await db.getRepository(Project).findOne({ where: { id: params.projectId, archivedAt: IsNull() } });
    if (!project) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    const membership = await db.getRepository(ProjectMember).findOne({ where: { projectId: project.id, userId: user!.id } });
    if (user!.role !== 'ADMIN' && !membership) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    const [total, done] = await Promise.all([
      db.getRepository(Task).count({ where: { projectId: project.id, archivedAt: IsNull() } }),
      db.getRepository(Task).count({ where: { projectId: project.id, archivedAt: IsNull(), status: 'DONE' } }),
    ]);
    return NextResponse.json({ project, progress: total ? Math.round(done / total * 100) : 0 });
  } catch (error) {
    return jsonError(error);
  }
}
