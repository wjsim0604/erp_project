import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { IsNull } from 'typeorm';
import { getDataSource } from '@/server/data-source';
import { DailyReport, ProjectMember, ReportItem, Task, User } from '@/server/entities';
import { recordAudit } from '@/server/audit';
import { jsonError, requireUser } from '@/server/http';
import { notifyUser } from '@/server/notifications';

const reportInput = z.object({ summary: z.string().max(20000).nullable().optional(), blockers: z.string().max(20000).nullable().optional(), nextPlan: z.string().max(20000).nullable().optional(), sourceNote: z.string().max(6000).nullable().optional(), submit: z.boolean().optional(), items: z.array(z.object({ category: z.enum(['COMPLETED','IN_PROGRESS','BLOCKED','NEXT']), content: z.string().trim().min(1).max(5000), projectId: z.string().uuid().nullable().optional(), taskId: z.string().uuid().nullable().optional(), source: z.enum(['USER','AI_SUGGESTION']).default('USER') })).max(50).optional() });
type Context = { params: { reportDate: string } };

export async function GET(request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser(); if (response) return response;
  const date = z.string().date().safeParse(params.reportDate);
  if (!date.success) return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다.' }, { status: 400 });
  const requestedUserId = request.nextUrl.searchParams.get('userId');
  if (requestedUserId && user!.role !== 'ADMIN') return NextResponse.json({ error: '다른 직원의 보고서는 관리자만 열람할 수 있습니다.' }, { status: 403 });
  if (requestedUserId && !z.string().uuid().safeParse(requestedUserId).success) return NextResponse.json({ error: '직원 ID 형식이 올바르지 않습니다.' }, { status: 400 });
  try {
    const db = await getDataSource();
    const report = await db.getRepository(DailyReport).findOne({ where: { userId: requestedUserId ?? user!.id, reportDate: date.data } });
    if (!report) return NextResponse.json({ report: null, items: [] });
    const items = await db.getRepository(ReportItem).find({ where: { reportId: report.id }, order: { createdAt: 'ASC' } });
    return NextResponse.json({ report, items });
  } catch (error) { return jsonError(error); }
}

export async function PUT(request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser(['ADMIN','MANAGER','MEMBER']); if (response) return response;
  const date = z.string().date().safeParse(params.reportDate);
  if (!date.success) return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다.' }, { status: 400 });
  const parsed = reportInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '보고서 내용을 확인해 주세요.', details: parsed.error.flatten() }, { status: 400 });
  try {
    const db = await getDataSource();
    const report = await db.transaction(async manager => {
      const repository = manager.getRepository(DailyReport);
      const existing = await repository.findOne({ where: { userId: user!.id, reportDate: date.data } });
      const { items: _items, submit, ...fields } = parsed.data;
      const saved = await repository.save(repository.create({ ...existing, id: existing?.id ?? randomUUID(), userId: user!.id, reportDate: date.data, ...fields, sourceNote: fields.sourceNote ?? existing?.sourceNote ?? null, status: submit ? 'SUBMITTED' : (existing?.status ?? 'DRAFT') }));
      if (parsed.data.items) {
        for (const item of parsed.data.items) {
          if (item.projectId && user!.role !== 'ADMIN' && !(await manager.getRepository(ProjectMember).exist({ where: { projectId: item.projectId, userId: user!.id } }))) throw new Error('REPORT_PROJECT_ACCESS');
          if (item.taskId) {
            const task = await manager.getRepository(Task).findOneBy({ id: item.taskId, archivedAt: IsNull() });
            if (!task || task.projectId !== item.projectId) throw new Error('REPORT_TASK_INVALID');
          }
        }
        await manager.getRepository(ReportItem).delete({ reportId: saved.id });
        if (parsed.data.items.length) await manager.getRepository(ReportItem).insert(parsed.data.items.map(item => ({ ...item, id: randomUUID(), reportId: saved.id, projectId: item.projectId ?? null, taskId: item.taskId ?? null })));
      }
      return saved;
    });
    await recordAudit({ actorId: user!.id, action: parsed.data.submit ? 'report.submit' : 'report.save', targetType: 'daily_report', targetId: report.id, metadata: { reportDate: date.data } });
    const items = await db.getRepository(ReportItem).find({ where: { reportId: report.id }, order: { createdAt: 'ASC' } });
    if (parsed.data.submit) {
      const administrators = await db.getRepository(User).find({ where: { role: 'ADMIN', active: true }, select: { id: true } });
      const projectIds = [...new Set(items.map(item => item.projectId).filter((id): id is string => !!id))];
      const managerIds = projectIds.length ? (await db.getRepository(ProjectMember).find({ where: { projectId: In(projectIds), projectRole: 'MANAGER' }, select: { userId: true } })).map(member => member.userId) : [];
      const reviewerIds = [...new Set([...administrators.map(admin => admin.id), ...managerIds])].filter(id => id !== user!.id);
      await Promise.allSettled(reviewerIds.map(id => notifyUser({ userId: id, kind: 'report_submitted', title: '새 업무 보고서가 제출되었습니다', body: `${date.data} 프로젝트 연결 보고 항목이 제출되었습니다.`, href: '/reports' })));
    }
    return NextResponse.json({ report, items });
  } catch (error) {
    if (error instanceof Error && error.message === 'REPORT_PROJECT_ACCESS') return NextResponse.json({ error: '프로젝트 접근 권한이 없습니다.' }, { status: 403 });
    if (error instanceof Error && error.message === 'REPORT_TASK_INVALID') return NextResponse.json({ error: '업무와 프로젝트 연결을 확인해 주세요.' }, { status: 400 });
    return jsonError(error);
  }
}
