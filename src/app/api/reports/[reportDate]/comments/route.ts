import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { In } from 'typeorm';
import { z } from 'zod';
import { getDataSource } from '@/server/data-source';
import { DailyReport, ProjectMember, ReportComment, ReportItem, User } from '@/server/entities';
import { jsonError, requireUser } from '@/server/http';
import { notifyUser } from '@/server/notifications';
import { checkRateLimit } from '@/server/rate-limit';

type Context = { params: { reportDate: string } };
const commentInput = z.object({ userId: z.string().uuid().optional(), content: z.string().trim().min(1).max(5000) });

async function canManagerReview(db: Awaited<ReturnType<typeof getDataSource>>, managerId: string, reportId: string) {
  const memberships = await db.getRepository(ProjectMember).find({ where: { userId: managerId, projectRole: 'MANAGER' }, select: { projectId: true } });
  const projectIds = memberships.map(membership => membership.projectId);
  return projectIds.length > 0 && db.getRepository(ReportItem).exist({ where: { reportId, projectId: In(projectIds) } });
}

export async function GET(request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser();
  if (response) return response;
  const date = z.string().date().safeParse(params.reportDate);
  const userId = request.nextUrl.searchParams.get('userId') ?? user!.id;
  if (!date.success || !z.string().uuid().safeParse(userId).success) return NextResponse.json({ error: '보고서 정보를 확인해 주세요.' }, { status: 400 });
  if (user!.role !== 'ADMIN' && userId !== user!.id && user!.role !== 'MANAGER') return NextResponse.json({ error: '본인 보고서의 댓글만 볼 수 있습니다.' }, { status: 403 });
  try {
    const db = await getDataSource();
    const report = await db.getRepository(DailyReport).findOne({ where: { userId, reportDate: date.data } });
    if (!report) return NextResponse.json({ comments: [] });
    if (user!.role === 'MANAGER' && userId !== user!.id && !(await canManagerReview(db, user!.id, report.id))) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 });
    const comments = await db.getRepository(ReportComment).createQueryBuilder('comment')
      .innerJoin(User, 'author', 'author.id = comment.authorId')
      .select('comment.id', 'id').addSelect('comment.content', 'content').addSelect('comment.createdAt', 'createdAt')
      .addSelect('comment.authorId', 'authorId').addSelect('author.displayName', 'authorName')
      .where('comment.reportId = :reportId', { reportId: report.id }).orderBy('comment.createdAt', 'ASC').getRawMany();
    return NextResponse.json({ comments });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!(await checkRateLimit(user!.id, 'report.comment', 30, 3600))) return NextResponse.json({ error: '댓글 요청이 많습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429, headers: { 'Retry-After': '3600' } });
  const date = z.string().date().safeParse(params.reportDate);
  const parsed = commentInput.safeParse(await request.json().catch(() => null));
  if (!date.success || !parsed.success) return NextResponse.json({ error: '댓글 내용을 확인해 주세요.' }, { status: 400 });
  const targetUserId = parsed.data.userId ?? user!.id;
  if (user!.role !== 'ADMIN' && targetUserId !== user!.id && user!.role !== 'MANAGER') return NextResponse.json({ error: '본인 보고서에만 댓글을 남길 수 있습니다.' }, { status: 403 });
  try {
    const db = await getDataSource();
    const report = await db.getRepository(DailyReport).findOne({ where: { userId: targetUserId, reportDate: date.data } });
    if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 });
    if (user!.role === 'MANAGER' && targetUserId !== user!.id && !(await canManagerReview(db, user!.id, report.id))) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 });
    const repository = db.getRepository(ReportComment);
    const comment = await repository.save(repository.create({ id: randomUUID(), reportId: report.id, authorId: user!.id, content: parsed.data.content }));
    if (targetUserId !== user!.id) await notifyUser({ userId: targetUserId, kind: 'report_comment', title: '보고서에 검토 댓글이 등록되었습니다', body: `${date.data} 보고서에 새 댓글이 있습니다.`, href: '/reports' }).catch(() => undefined);
    return NextResponse.json({ comment: { id: comment.id, content: comment.content, createdAt: comment.createdAt, authorId: user!.id, authorName: user!.name || '사용자' } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
