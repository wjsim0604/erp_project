import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataSource } from '@/server/data-source';
import { User } from '@/server/entities';
import { recordAudit } from '@/server/audit';
import { jsonError, requireUser } from '@/server/http';

const inputSchema = z.object({ role: z.enum(['ADMIN','MANAGER','MEMBER','VIEWER']).optional(), active: z.boolean().optional() }).refine(value => Object.keys(value).length > 0);
export async function PATCH(request: NextRequest, { params }: { params: { userId: string } }) {
  const { user, response } = await requireUser(['ADMIN']); if (response) return response;
  if (params.userId === user!.id) return NextResponse.json({ error: '현재 로그인한 관리자 본인의 계정은 이 화면에서 변경할 수 없습니다.' }, { status: 400 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '변경할 역할이나 계정 상태를 확인해 주세요.' }, { status: 400 });
  try {
    const db = await getDataSource();
    const target = await db.getRepository(User).findOneBy({ id: params.userId });
    if (!target) return NextResponse.json({ error: '직원을 찾을 수 없습니다.' }, { status: 404 });
    const removesAdmin = target.active && target.role === 'ADMIN' && ((parsed.data.role && parsed.data.role !== 'ADMIN') || parsed.data.active === false);
    if (removesAdmin && await db.getRepository(User).countBy({ role: 'ADMIN', active: true }) <= 1) return NextResponse.json({ error: '활성 시스템 관리자는 한 명 이상 유지해야 합니다.' }, { status: 409 });
    const previous = { role: target.role, active: target.active };
    Object.assign(target, parsed.data);
    await db.getRepository(User).save(target);
    await recordAudit({ actorId: user!.id, action: 'user.update', targetType: 'user', targetId: target.id, metadata: { previous, current: { role: target.role, active: target.active } } });
    return NextResponse.json({ user: { id: target.id, email: target.email, displayName: target.displayName, role: target.role, active: target.active } });
  } catch (error) { return jsonError(error); }
}
