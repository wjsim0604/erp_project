import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/server/http';
import MfaSettings from './mfa-settings';

export default async function AdminSecurityPage() {
  const { user } = await requireUser(['ADMIN']);
  if (!user) redirect('/login');
  return <main className="module-page"><header><div><Link href="/admin/users">← 직원 관리</Link><h1>관리자 보안</h1><p>인증 앱을 이용해 관리자 로그인에 2단계 인증을 추가합니다.</p></div></header><MfaSettings/></main>;
}
