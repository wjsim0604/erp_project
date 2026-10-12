'use client';

import { FormEvent, useEffect, useState } from 'react';

export default function MfaSettings() {
  const [enabled, setEnabled] = useState(false);
  const [secret, setSecret] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { fetch('/api/admin/security/mfa').then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setEnabled(data.enabled); }).catch(reason => setError(reason instanceof Error ? reason.message : '보안 설정을 불러오지 못했습니다.')); }, []);

  async function request(action: 'setup'|'enable'|'disable', event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/security/mfa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(action === 'setup' ? { action } : { action, code }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '보안 설정을 저장하지 못했습니다.');
      if (action === 'setup') setSecret(data.secret);
      else { setEnabled(data.enabled); setSecret(''); setRecoveryCodes(data.recoveryCodes ?? []); setCode(''); setMessage(data.enabled ? '2단계 인증을 사용 설정했습니다.' : '2단계 인증을 해제했습니다.'); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : '보안 설정을 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }

  return <section className="module-card mfa-settings"><div className="module-card-head"><h2>관리자 2단계 인증</h2><span>{enabled ? '사용 중' : '사용 안 함'}</span></div><p>인증 앱의 6자리 코드 또는 복구 코드를 관리자 비밀번호와 함께 입력합니다. 인증 앱은 30초마다 코드를 바꿉니다.</p>{!enabled && !secret && <button disabled={busy} onClick={() => request('setup')}>인증 앱 연결 시작</button>}{secret && <div className="mfa-enrollment"><b>인증 앱에 이 키를 등록하세요</b><code>{secret}</code><p>앱에서 Flow ERP 계정을 추가하고 표시되는 6자리 코드를 입력해 연결을 확인하세요.</p><form className="data-form" onSubmit={event => request('enable', event)}><label>인증 코드<input value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required maxLength={6}/></label><button disabled={busy || code.length !== 6}>사용 설정</button></form></div>}{recoveryCodes.length > 0 && <div className="recovery-codes"><b>복구 코드 (각 1회 사용)</b><p>이 코드는 지금만 표시됩니다. 안전한 곳에 저장하세요.</p><ul>{recoveryCodes.map(recoveryCode => <li key={recoveryCode}><code>{recoveryCode}</code></li>)}</ul></div>}{enabled && <form className="data-form" onSubmit={event => request('disable', event)}><label>인증 앱 코드 또는 복구 코드<input value={code} onChange={event => setCode(event.target.value.trim().slice(0, 32))} autoComplete="one-time-code" required maxLength={32}/></label><button className="danger-button" disabled={busy || code.length < 6}>2단계 인증 해제</button></form>}{error && <p className="module-error" role="alert">{error}</p>}{message && <p className="module-success" role="status">{message}</p>}</section>;
}
