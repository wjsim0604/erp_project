import { NextRequest, NextResponse } from 'next/server';
import { IsNull } from 'typeorm';
import { getDataSource } from '@/server/data-source';
import { AuditLog, Project, ProjectMember, Task, User } from '@/server/entities';
import { jsonError, requireUser } from '@/server/http';

type Context = { params: { projectId: string } };

export async function GET(_request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser();
  if (response) return response;
  try {
    const db = await getDataSource();
    const projectExists = await db.getRepository(Project).exist({ where: { id: params.projectId, archivedAt: IsNull() } });
    if (!projectExists) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    if (user!.role !== 'ADMIN' && !(await db.getRepository(ProjectMember).exist({ where: { projectId: params.projectId, userId: user!.id } }))) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }
    const entries = await db.getRepository(AuditLog).createQueryBuilder('audit')
      .leftJoin(User, 'actor', 'actor.id = audit.actorId')
      .leftJoin(Task, 'task', "audit.targetType = 'task' AND task.id = audit.targetId")
      .select('audit.id', 'id').addSelect('audit.action', 'action').addSelect('audit.targetType', 'targetType')
      .addSelect('audit.createdAt', 'createdAt').addSelect('actor.displayName', 'actorName')
      .addSelect('task.title', 'taskTitle')
      .where("(audit.targetType = 'project' AND audit.targetId = :projectId) OR (audit.targetType = 'task' AND task.projectId = :projectId)", { projectId: params.projectId })
      .orderBy('audit.createdAt', 'DESC').take(50).getRawMany();
    return NextResponse.json({ entries });
  } catch (error) {
    return jsonError(error);
  }
}
