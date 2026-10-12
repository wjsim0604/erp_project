import { NextRequest, NextResponse } from 'next/server';
import { IsNull, In } from 'typeorm';
import { getDataSource } from '@/server/data-source';
import { Notification } from '@/server/entities';
import { jsonError, requireUser } from '@/server/http';
import { z } from 'zod';

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  try {
    const repo = (await getDataSource()).getRepository(Notification);
    const [notifications, unreadCount] = await Promise.all([
      repo.find({ where: { userId: user!.id }, order: { createdAt: 'DESC' }, take: 20 }),
      repo.count({ where: { userId: user!.id, readAt: IsNull() } }),
    ]);
    return NextResponse.json({ notifications, unreadCount });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;
  const parsed = z.object({ ids: z.array(z.string().uuid()).max(20).optional(), all: z.boolean().optional() }).refine(value => value.all === true || !!value.ids?.length).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '읽음으로 표시할 알림을 지정해 주세요.' }, { status: 400 });
  try {
    const repo = (await getDataSource()).getRepository(Notification);
    const where = parsed.data.all ? { userId: user!.id, readAt: IsNull() } : { userId: user!.id, id: In(parsed.data.ids!), readAt: IsNull() };
    await repo.update(where, { readAt: new Date() });
    return NextResponse.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
