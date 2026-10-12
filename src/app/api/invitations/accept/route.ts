import { createHash, randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataSource } from '@/server/data-source';
import { Invitation, User } from '@/server/entities';
import { jsonError } from '@/server/http';

const acceptInput = z.object({ token: z.string().min(32).max(128), email: z.string().email().max(254), displayName: z.string().trim().min(1).max(100), password: z.string().min(12).max(128) });
export async function POST(request: NextRequest) {
  const parsed = acceptInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '초대 수락 정보를 확인해 주세요.' }, { status: 400 });
  try {
    const { token, password, ...fields } = parsed.data;
    const email = fields.email.toLowerCase();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const passwordHash = await hash(password, 12);
    const db = await getDataSource();
    const user = await db.transaction(async manager => {
      const invitation = await manager.getRepository(Invitation).createQueryBuilder('invitation').setLock('pessimistic_write')
        .where('invitation.email = :email AND invitation.tokenHash = :tokenHash AND invitation.acceptedAt IS NULL AND invitation.expiresAt > :now', { email, tokenHash, now: new Date() }).getOne();
      if (!invitation) return null;
      const account = manager.getRepository(User).create({ id: randomUUID(), email, displayName: fields.displayName, passwordHash, role: invitation.role, active: true });
      await manager.getRepository(User).save(account);
      invitation.acceptedAt = new Date();
      await manager.getRepository(Invitation).save(invitation);
      return account;
    });
    if (!user) return NextResponse.json({ error: '초대가 만료되었거나 이미 사용되었습니다.' }, { status: 400 });
    return NextResponse.json({ user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
