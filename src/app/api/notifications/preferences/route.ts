import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataSource } from '@/server/data-source';
import { NotificationPreference } from '@/server/entities';
import { jsonError, requireUser } from '@/server/http';

const input = z.object({
  taskAssignedInApp: z.boolean(), reportSubmittedInApp: z.boolean(), reportCommentInApp: z.boolean(),
  taskAssignedEmail: z.boolean(), reportSubmittedEmail: z.boolean(), reportCommentEmail: z.boolean(),
});
const defaults = { taskAssignedInApp: true, reportSubmittedInApp: true, reportCommentInApp: true, taskAssignedEmail: false, reportSubmittedEmail: false, reportCommentEmail: false };

export async function GET() {
  const { user, response } = await requireUser(); if (response) return response;
  try {
    const preference = await (await getDataSource()).getRepository(NotificationPreference).findOneBy({ userId: user!.id });
    return NextResponse.json({ preferences: { ...defaults, ...preference }, emailConfigured: !!process.env.NOTIFICATION_WEBHOOK_URL });
  } catch (error) { return jsonError(error); }
}

export async function PUT(request: NextRequest) {
  const { user, response } = await requireUser(); if (response) return response;
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '알림 설정을 확인해 주세요.' }, { status: 400 });
  try {
    const repo = (await getDataSource()).getRepository(NotificationPreference);
    await repo.save(repo.create({ userId: user!.id, ...parsed.data }));
    return NextResponse.json({ preferences: parsed.data, emailConfigured: !!process.env.NOTIFICATION_WEBHOOK_URL });
  } catch (error) { return jsonError(error); }
}
