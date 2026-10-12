'use client';
import { useEffect, useState } from 'react';
type Preferences = { taskAssignedInApp: boolean; reportSubmittedInApp: boolean; reportCommentInApp: boolean; taskAssignedEmail: boolean; reportSubmittedEmail: boolean; reportCommentEmail: boolean };
const defaults: Preferences = { taskAssignedInApp: true, reportSubmittedInApp: true, reportCommentInApp: true, taskAssignedEmail: false, reportSubmittedEmail: false, reportCommentEmail: false };
const rows: { label: string; app: keyof Preferences; email: keyof Preferences }[] = [
  { label: '업무 배정', app: 'taskAssignedInApp', email: 'taskAssignedEmail' },
  { label: '업무 보고서 제출', app: 'reportSubmittedInApp', email: 'reportSubmittedEmail' },
  { label: '보고서 댓글', app: 'reportCommentInApp', email: 'reportCommentEmail' },
];
export default function NotificationSettings() {
  const [preferences, setPreferences] = useState<Preferences>(defaults); const [emailConfigured, setEmailConfigured] = useState(false); const [message, setMessage] = useState('불러오는 중…'); const [saving, setSaving] = useState(false);
  useEffect(() => { fetch('/api/notifications/preferences').then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setPreferences(data.preferences); setEmailConfigured(data.emailConfigured); setMessage(''); }).catch(error => setMessage(error instanceof Error ? error.message : '설정을 불러오지 못했습니다.')); }, []);
  async function save() { setSaving(true); setMessage(''); try { const response = await fetch('/api/notifications/preferences', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(preferences) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMessage('알림 설정을 저장했습니다.'); } catch (error) { setMessage(error instanceof Error ? error.message : '저장하지 못했습니다.'); } finally { setSaving(false); } }
  return <section className="module-card"><div className="module-card-head"><h2>전달 채널</h2></div><p className="empty-state">이메일 전달은 운영자가 알림 웹훅을 설정한 경우에 사용할 수 있습니다.{!emailConfigured && ' 현재 이메일 채널은 아직 연결되지 않았습니다.'}</p><div className="entity-list">{rows.map(row => <div className="task-entity" key={row.label}><b>{row.label}</b><label><input type="checkbox" checked={preferences[row.app]} onChange={event => setPreferences(value => ({ ...value, [row.app]: event.target.checked }))}/> 앱 알림</label><label><input type="checkbox" disabled={!emailConfigured} checked={preferences[row.email]} onChange={event => setPreferences(value => ({ ...value, [row.email]: event.target.checked }))}/> 이메일</label></div>)}</div>{message && <p role="status">{message}</p>}<button onClick={save} disabled={saving}>{saving ? '저장 중…' : '설정 저장'}</button></section>;
}
