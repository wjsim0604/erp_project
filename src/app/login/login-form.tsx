'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { loginAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? '로그인 중…' : '로그인'}</button>;
}

export default function LoginForm() {
  const [state, action] = useFormState(loginAction, { error: null as string | null });
  return <form action={action} className="login-form">
    <label>이메일<input autoComplete="username" type="email" name="email" required maxLength={254} placeholder="name@company.com" /></label>
    <label>비밀번호<input autoComplete="current-password" type="password" name="password" required maxLength={128} placeholder="비밀번호를 입력하세요" /></label>
    <label>인증 앱 코드 또는 복구 코드<input autoComplete="one-time-code" type="text" name="totp" maxLength={32} placeholder="MFA 사용 관리자만 입력" /></label>
    {state.error && <p className="login-error" role="alert">{state.error}</p>}
    <SubmitButton />
  </form>;
}
