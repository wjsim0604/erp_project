import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import { LessThan, MoreThan } from 'typeorm';
import { z } from 'zod';
import { getDataSource } from './data-source';
import { AuthLoginAttempt, User } from './entities';
import { hashRecoveryCode, verifyTotpSecret } from './security';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  pages: { signIn: '/login' },
  providers: [Credentials({
    credentials: { email: { label: '이메일', type: 'email' }, password: { label: '비밀번호', type: 'password' }, totp: { label: '인증 앱 코드 또는 복구 코드', type: 'text' } },
    async authorize(raw) {
      const parsed = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128), totp: z.string().max(32).optional() }).safeParse(raw);
      if (!parsed.success) return null;
      const db = await getDataSource();
      const email = parsed.data.email.toLowerCase();
      const emailHash = createHash('sha256').update(email).digest('hex');
      const attempts = db.getRepository(AuthLoginAttempt);
      const now = new Date();
      await attempts.delete({ createdAt: LessThan(new Date(now.getTime() - 24 * 60 * 60 * 1000)) });
      const recentAttempts = await attempts.count({ where: { emailHash, createdAt: MoreThan(new Date(now.getTime() - 15 * 60 * 1000)) } });
      if (recentAttempts >= 5) return null;
      const user = await db.getRepository(User).createQueryBuilder('user').addSelect('user.passwordHash')
        .addSelect('user.mfaSecret').addSelect('user.mfaRecoveryCodes').where('user.email = :email AND user.active = true', { email }).getOne();
      let valid = !!user && await compare(parsed.data.password, user.passwordHash);
      let mfaVerified = false;
      if (valid && user?.role === 'ADMIN' && user.mfaEnabled) {
        if (user.mfaSecret && parsed.data.totp) {
          try { mfaVerified = verifyTotpSecret(user.mfaSecret, parsed.data.totp); } catch { mfaVerified = false; }
        }
        if (!mfaVerified && parsed.data.totp && user.mfaRecoveryCodes) {
          try {
            const hashes = JSON.parse(user.mfaRecoveryCodes) as string[];
            const candidate = hashRecoveryCode(parsed.data.totp);
            if (hashes.includes(candidate)) {
              const remaining = JSON.stringify(hashes.filter(hash => hash !== candidate));
              const update = await db.getRepository(User).createQueryBuilder().update(User).set({ mfaRecoveryCodes: remaining })
                .where('id = :id AND mfa_recovery_codes = :stored', { id: user.id, stored: user.mfaRecoveryCodes }).execute();
              mfaVerified = update.affected === 1;
            }
          } catch { mfaVerified = false; }
        }
        valid = mfaVerified;
      }
      if (!valid || !user) {
        await attempts.save(attempts.create({ id: randomUUID(), emailHash }));
        return null;
      }
      await attempts.delete({ emailHash });
      return { id: user.id, name: user.displayName, email: user.email, role: user.role, mfaVerified };
    },
  })],
  callbacks: {
    jwt({ token, user }) { if (user) { token.sub = user.id; token.role = user.role; token.mfaVerified = user.mfaVerified === true; } return token; },
    session({ session, token }) { if (session.user) { session.user.id = token.sub!; session.user.role = token.role; session.user.mfaVerified = token.mfaVerified === true; } return session; },
  },
});
