import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { IsNull } from 'typeorm';
import { getDataSource } from '@/server/data-source';
import { ProjectMember, Task } from '@/server/entities';
import { recordAudit } from '@/server/audit';
import { jsonError, requireUser } from '@/server/http';
import { notifyUser } from '@/server/notifications';

const updateInput = z.object({ title: z.string().trim().min(1).max(200).optional(), description: z.string().max(20000).nullable().optional(), assigneeId: z.string().uuid().nullable().optional(), status: z.enum(['TODO','IN_PROGRESS','IN_REVIEW','DONE']).optional(), priority: z.enum(['LOW','MEDIUM','HIGH','URGENT']).optional(), startDate: z.string().date().nullable().optional(), dueDate: z.string().date().nullable().optional(), archived: z.boolean().optional() }).refine(data => Object.keys(data).length > 0);
type Context = { params: { taskId: string } };

export async function PATCH(request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser(); if (response) return response;
  const parsed = updateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '수정할 업무 정보를 확인해 주세요.' }, { status: 400 });
  try {
    const db = await getDataSource();
    const task = await db.getRepository(Task).findOneBy({ id: params.taskId, archivedAt: IsNull() });
    if (!task) return NextResponse.json({ error: '업무를 찾을 수 없습니다.' }, { status: 404 });
    const membership = await db.getRepository(ProjectMember).findOne({ where: { projectId: task.projectId, userId: user!.id } });
    if (user!.role !== 'ADMIN' && !membership) return NextResponse.json({ error: '업무를 찾을 수 없습니다.' }, { status: 404 });
    const manager = user!.role === 'ADMIN' || membership?.projectRole === 'MANAGER';
    if (!manager && task.assigneeId !== user!.id) return NextResponse.json({ error: '본인에게 배정된 업무만 수정할 수 있습니다.' }, { status: 403 });
    if (!manager && Object.keys(parsed.data).some(key => !['status', 'description'].includes(key))) return NextResponse.json({ error: '업무 상태와 설명만 수정할 수 있습니다.' }, { status: 403 });
    if (parsed.data.assigneeId && !(await db.getRepository(ProjectMember).exist({ where: { projectId: task.projectId, userId: parsed.data.assigneeId } }))) return NextResponse.json({ error: '담당자는 프로젝트 멤버여야 합니다.' }, { status: 400 });
    const { archived, ...changes } = parsed.data;
    const previousAssigneeId = task.assigneeId;
    Object.assign(task, changes);
    if (archived) task.archivedAt = new Date();
    await db.getRepository(Task).save(task);
    await recordAudit({ actorId: user!.id, action: archived ? 'task.archive' : 'task.update', targetType: 'task', targetId: task.id, metadata: changes });
    if (changes.assigneeId && changes.assigneeId !== previousAssigneeId && changes.assigneeId !== user!.id) await notifyUser({ userId: changes.assigneeId, kind: 'task_assigned', title: '새 업무가 배정되었습니다', body: task.title, href: `/projects/${task.projectId}` }).catch(() => undefined);
    return NextResponse.json({ task });
  } catch (error) { return jsonError(error); }
}
