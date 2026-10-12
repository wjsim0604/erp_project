import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataSource } from '@/server/data-source';
import { User } from '@/server/entities';
import { recordAudit } from '@/server/audit';
import { jsonError, requireUser } from '@/server/http';
import { encryptTotpSecret, generateRecoveryCodes, generateTotpSecret, hasMfaEncryptionKey, hashRecoveryCode, totpProvisioningUri, verifyTotpSecret } from '@/server/security';
import { checkRateLimit } from '@/server/rate-limit';

export async function GET() {
  const { user, response } = await requireUser(['ADMIN']);
  if (response) return response;
  try {
    const admin = await (await getDataSource()).getRepository(User).findOneBy({ id: user!.id });
    return NextResponse.json({ enabled: !!admin?.mfaEnabled });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(['ADMIN']);
  if (response) return response;
  if (!(await checkRateLimit(user!.id, 'admin.mfa', 10, 300))) return NextResponse.json({ error: '보안 설정 요청이 많습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429, headers: { 'Retry-After': '300' } });
  const parsed = z.discriminatedUnion('action', [
    z.object({ action: z.literal('setup') }),
    z.object({ action: z.literal('enable'), code: z.string().regex(/^\d{6}$/) }),
    z.object({ action: z.literal('disable'), code: z.string().min(6).max(32) }),
  ]).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'MFA 요청을 확인해 주세요.' }, { status: 400 });
  try {
    const repo = (await getDataSource()).getRepository(User);
    const admin = await repo.createQueryBuilder('user').addSelect('user.mfaSecret').addSelect('user.mfaPendingSecret').addSelect('user.mfaRecoveryCodes').where('user.id = :id AND user.role = :role AND user.active = true', { id: user!.id, role: 'ADMIN' }).getOne();
    if (!admin) return NextResponse.json({ error: '관리자 계정을 확인할 수 없습니다.' }, { status: 404 });
    if (parsed.data.action === 'setup') {
      if (admin.mfaEnabled) return NextResponse.json({ error: 'MFA가 이미 사용 설정되어 있습니다.' }, { status: 409 });
      if (!hasMfaEncryptionKey()) return NextResponse.json({ error: '서버에 MFA_ENCRYPTION_KEY를 32바이트 키로 설정해야 합니다.' }, { status: 503 });
      const secret = generateTotpSecret();
      await repo.update({ id: admin.id }, { mfaPendingSecret: encryptTotpSecret(secret) });
      return NextResponse.json({ secret, provisioningUri: totpProvisioningUri(secret, admin.email) });
    }
    if (parsed.data.action === 'enable') {
      if (!admin.mfaPendingSecret || !verifyTotpSecret(admin.mfaPendingSecret, parsed.data.code)) return NextResponse.json({ error: '인증 코드가 맞지 않습니다. 기기 시간을 확인해 주세요.' }, { status: 400 });
      const recovery = generateRecoveryCodes();
      await repo.update({ id: admin.id }, { mfaSecret: admin.mfaPendingSecret, mfaPendingSecret: null, mfaRecoveryCodes: JSON.stringify(recovery.hashes), mfaEnabled: true });
      await recordAudit({ actorId: admin.id, action: 'admin.mfa_enable', targetType: 'user', targetId: admin.id, metadata: null }).catch(() => undefined);
      return NextResponse.json({ enabled: true, recoveryCodes: recovery.codes });
    }
    let verified = false;
    if (admin.mfaEnabled && admin.mfaSecret) { try { verified = verifyTotpSecret(admin.mfaSecret, parsed.data.code); } catch { verified = false; } }
    if (!verified && admin.mfaEnabled && admin.mfaRecoveryCodes) {
      try {
        const hashes = JSON.parse(admin.mfaRecoveryCodes) as string[];
        const candidate = hashRecoveryCode(parsed.data.code);
        if (hashes.includes(candidate)) {
          const update = await repo.createQueryBuilder().update(User).set({ mfaRecoveryCodes: JSON.stringify(hashes.filter(hash => hash !== candidate)) })
            .where('id = :id AND mfa_recovery_codes = :stored', { id: admin.id, stored: admin.mfaRecoveryCodes }).execute();
          verified = update.affected === 1;
        }
      } catch { verified = false; }
    }
    if (!verified) return NextResponse.json({ error: '인증 코드가 맞지 않습니다.' }, { status: 400 });
    await repo.update({ id: admin.id }, { mfaSecret: null, mfaPendingSecret: null, mfaRecoveryCodes: null, mfaEnabled: false });
    await recordAudit({ actorId: admin.id, action: 'admin.mfa_disable', targetType: 'user', targetId: admin.id, metadata: null }).catch(() => undefined);
    return NextResponse.json({ enabled: false });
  } catch (error) { return jsonError(error); }
}
