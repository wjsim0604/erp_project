'use client';
import { FormEvent, useState } from 'react';
export default function AcceptInvitationForm({ token, email }: { token: string; email: string }) {
  const [error, setError] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError(''); const response = await fetch('/api/invitations/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, email, displayName: form.get('displayName'), password: form.get('password') }) }); const data = await response.json(); setBusy(false); if (!response.ok) { setError(data.error ?? '초대를 수락하지 못했습니다.'); return; } setDone(true); }
  if (done) return <div className="invite-done"><p>계정이 만들어졌습니다.</p><a href="/login">로그인하기 →</a></div>;
  return <form className="login-form" onSubmit={submit}><label>초대된 이메일<input value={email} readOnly/></label><label>이름<input name="displayName" required maxLength={100}/></label><label>비밀번호<input type="password" name="password" minLength={12} maxLength={128} autoComplete="new-password" required/><small>12자 이상으로 설정해 주세요.</small></label>{error && <p className="login-error" role="alert">{error}</p>}<button disabled={busy || !token}>{busy ? '계정 생성 중…' : '초대 수락'}</button></form>;
}
