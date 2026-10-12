import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataSource } from '@/server/data-source';
import { Invitation, User } from '@/server/entities';
import { recordAudit } from '@/server/audit';
import { jsonError, requireUser } from '@/server/http';
import { checkRateLimit } from '@/server/rate-limit';

const invitationInput = z.object({ email: z.string().email().max(254), role: z.enum(['MANAGER','MEMBER','VIEWER']).default('MEMBER') });
export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(['ADMIN']); if (response) return response;
  if (!(await checkRateLimit(user!.id, 'invitation.create', 10, 3600))) return NextResponse.json({ error: '초대 요청이 많습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429, headers: { 'Retry-After': '3600' } });
  const parsed = invitationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '초대 정보를 확인해 주세요.' }, { status: 400 });
  try {
    const db = await getDataSource();
    const email = parsed.data.email.toLowerCase();
    if (await db.getRepository(User).exist({ where: { email } })) return NextResponse.json({ error: '이미 등록된 이메일입니다.' }, { status: 409 });
    const token = randomBytes(32).toString('base64url');
    const invitation = db.getRepository(Invitation).create({ id: randomUUID(), email, role: parsed.data.role, invitedBy: user!.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), acceptedAt: null });
    await db.getRepository(Invitation).save(invitation);
    await recordAudit({ actorId: user!.id, action: 'user.invite', targetType: 'invitation', targetId: invitation.id, metadata: { email, role: invitation.role } });
    const origin = request.nextUrl.origin;
    return NextResponse.json({ invitation: { id: invitation.id, email, role: invitation.role, expiresAt: invitation.expiresAt, acceptanceUrl: `${origin}/accept-invitation?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}` } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
