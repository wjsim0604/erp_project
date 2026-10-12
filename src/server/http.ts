import { NextResponse } from 'next/server';
import { auth } from './auth';
import { getDataSource } from './data-source';
import { User } from './entities';

export type CurrentUser = { id: string; role: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER'; name?: string | null; email?: string | null };
export async function requireUser(roles?: CurrentUser['role'][]) {
  const session = await auth();
  if (!session?.user?.id) return { user: null, response: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) };
  const account = await (await getDataSource()).getRepository(User).findOne({ where: { id: session.user.id, active: true } });
  if (!account) return { user: null, response: NextResponse.json({ error: '계정을 사용할 수 없습니다.' }, { status: 401 }) };
  if (account.role === 'ADMIN' && account.mfaEnabled && session.user.mfaVerified !== true) return { user: null, response: NextResponse.json({ error: '관리자 인증이 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 }) };
  const user: CurrentUser = { id: account.id, role: account.role, name: account.displayName, email: account.email };
  if (roles && !roles.includes(user.role)) return { user: null, response: NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 }) };
  return { user, response: null };
}

export function jsonError(error: unknown) {
  console.error('API request failed', error);
  return NextResponse.json({ error: '요청을 처리하지 못했습니다.' }, { status: 500 });
}
