import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import LoginForm from './login-form';

export default async function LoginPage() {
  if ((await auth())?.user) redirect('/');
  return <main className="login-page"><section className="login-card"><a className="brand login-brand" href="/"> <span className="brand-mark">F</span><span>flow<span className="brand-light">works</span></span></a><h1>다시 만나 반가워요</h1><p>계정에 로그인하고 업무를 이어가세요.</p><LoginForm/><small>초대받은 팀원만 로그인할 수 있습니다. 계정이 필요하면 관리자에게 문의하세요.</small></section></main>;
}
