import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataSource } from '@/server/data-source';
import { Project, ProjectMember, User } from '@/server/entities';
import { recordAudit } from '@/server/audit';
import { jsonError, requireUser } from '@/server/http';

type Context = { params: { projectId: string } };
const memberInput = z.object({ email: z.string().email().max(254), projectRole: z.enum(['MANAGER','MEMBER','VIEWER']).default('MEMBER') });
async function canManage(projectId: string, userId: string, isAdmin: boolean) {
  if (isAdmin) return true;
  const member = await (await getDataSource()).getRepository(ProjectMember).findOne({ where: { projectId, userId } });
  return member?.projectRole === 'MANAGER';
}

export async function GET(_request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser(); if (response) return response;
  try {
    const db = await getDataSource();
    const member = await db.getRepository(ProjectMember).findOne({ where: { projectId: params.projectId, userId: user!.id } });
    if (user!.role !== 'ADMIN' && !member) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    const members = await db.getRepository(ProjectMember).createQueryBuilder('member').innerJoin(User, 'user', 'user.id = member.userId')
      .select('member.id', 'id').addSelect('member.projectRole', 'projectRole').addSelect('user.id', 'userId').addSelect('user.displayName', 'displayName').addSelect('user.email', 'email')
      .where('member.projectId = :projectId AND user.active = true', { projectId: params.projectId }).orderBy('user.displayName', 'ASC').getRawMany();
    return NextResponse.json({ members, canManage: user!.role === 'ADMIN' || member?.projectRole === 'MANAGER' });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser(); if (response) return response;
  const parsed = memberInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '멤버 정보를 확인해 주세요.' }, { status: 400 });
  try {
    const db = await getDataSource();
    if (!(await canManage(params.projectId, user!.id, user!.role === 'ADMIN'))) return NextResponse.json({ error: '프로젝트 관리 권한이 없습니다.' }, { status: 403 });
    const target = await db.getRepository(User).findOne({ where: { email: parsed.data.email.toLowerCase(), active: true } });
    if (!target) return NextResponse.json({ error: '활성 사용자 계정을 찾을 수 없습니다. 먼저 직원을 초대해 주세요.' }, { status: 404 });
    const project = await db.getRepository(Project).findOneBy({ id: params.projectId });
    if (!project) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    if (await db.getRepository(ProjectMember).exist({ where: { projectId: project.id, userId: target.id } })) return NextResponse.json({ error: '이미 프로젝트 멤버입니다.' }, { status: 409 });
    const membership = db.getRepository(ProjectMember).create({ id: randomUUID(), projectId: project.id, userId: target.id, projectRole: parsed.data.projectRole });
    await db.getRepository(ProjectMember).save(membership);
    await recordAudit({ actorId: user!.id, action: 'project.member_add', targetType: 'project', targetId: project.id, metadata: { memberId: target.id, role: membership.projectRole } });
    return NextResponse.json({ member: { id: membership.id, userId: target.id, displayName: target.displayName, email: target.email, projectRole: membership.projectRole } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser(); if (response) return response;
  const targetId = z.string().uuid().safeParse(request.nextUrl.searchParams.get('userId'));
  if (!targetId.success) return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 });
  try {
    const db = await getDataSource();
    if (!(await canManage(params.projectId, user!.id, user!.role === 'ADMIN'))) return NextResponse.json({ error: '프로젝트 관리 권한이 없습니다.' }, { status: 403 });
    const project = await db.getRepository(Project).findOneBy({ id: params.projectId });
    if (!project) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    if (project.ownerId === targetId.data) return NextResponse.json({ error: '프로젝트 소유자는 제거할 수 없습니다.' }, { status: 409 });
    const result = await db.getRepository(ProjectMember).delete({ projectId: params.projectId, userId: targetId.data });
    if (!result.affected) return NextResponse.json({ error: '프로젝트 멤버를 찾을 수 없습니다.' }, { status: 404 });
    await recordAudit({ actorId: user!.id, action: 'project.member_remove', targetType: 'project', targetId: project.id, metadata: { memberId: targetId.data } });
    return NextResponse.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
