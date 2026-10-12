import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataSource } from '@/server/data-source';
import { ProjectMember, Task } from '@/server/entities';
import { IsNull } from 'typeorm';
import { jsonError, requireUser } from '@/server/http';
import { recordAudit } from '@/server/audit';
import { notifyUser } from '@/server/notifications';

const taskInput = z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(20000).optional(), assigneeId: z.string().uuid().nullable().optional(), status: z.enum(['TODO','IN_PROGRESS','IN_REVIEW','DONE']).default('TODO'), priority: z.enum(['LOW','MEDIUM','HIGH','URGENT']).default('MEDIUM'), startDate: z.string().date().nullable().optional(), dueDate: z.string().date().nullable().optional() });
type Context = { params: { projectId: string } };

async function canSeeProject(projectId: string, userId: string, isAdmin: boolean) {
  if (isAdmin) return true;
  return (await (await getDataSource()).getRepository(ProjectMember).exist({ where: { projectId, userId } }));
}

export async function GET(_request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser(); if (response) return response;
  try {
    if (!(await canSeeProject(params.projectId, user!.id, user!.role === 'ADMIN'))) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    const tasks = await (await getDataSource()).getRepository(Task).find({ where: { projectId: params.projectId, archivedAt: IsNull() }, order: { dueDate: 'ASC', updatedAt: 'DESC' } });
    return NextResponse.json({ tasks });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser(['ADMIN','MANAGER','MEMBER']); if (response) return response;
  const parsed = taskInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '업무 정보를 확인해 주세요.', details: parsed.error.flatten() }, { status: 400 });
  try {
    const db = await getDataSource();
    if (!(await canSeeProject(params.projectId, user!.id, user!.role === 'ADMIN'))) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    const membership = await db.getRepository(ProjectMember).findOne({ where: { projectId: params.projectId, userId: user!.id } });
    if (user!.role !== 'ADMIN' && membership?.projectRole === 'VIEWER') return NextResponse.json({ error: '업무를 추가할 권한이 없습니다.' }, { status: 403 });
    if (parsed.data.assigneeId && !(await db.getRepository(ProjectMember).exist({ where: { projectId: params.projectId, userId: parsed.data.assigneeId } }))) return NextResponse.json({ error: '담당자는 프로젝트 멤버여야 합니다.' }, { status: 400 });
    const task = db.getRepository(Task).create({ id: randomUUID(), ...parsed.data, projectId: params.projectId, createdBy: user!.id, assigneeId: parsed.data.assigneeId ?? null, description: parsed.data.description ?? null, startDate: parsed.data.startDate ?? null, dueDate: parsed.data.dueDate ?? null });
    await db.getRepository(Task).save(task);
    await recordAudit({ actorId: user!.id, action: 'task.create', targetType: 'task', targetId: task.id, metadata: { title: task.title, projectId: params.projectId } });
    if (task.assigneeId && task.assigneeId !== user!.id) await notifyUser({ userId: task.assigneeId, kind: 'task_assigned', title: '새 업무가 배정되었습니다', body: task.title, href: `/projects/${params.projectId}` }).catch(() => undefined);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
