'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type NotificationRow = { id: string; kind: string; title: string; body: string; href: string; readAt: string | null; createdAt: string };

export default function WorkspaceNotifications() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');

  async function refresh() {
    const response = await fetch('/api/notifications');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? '알림을 불러오지 못했습니다.');
    setNotifications(data.notifications); setUnreadCount(data.unreadCount);
  }
  useEffect(() => { refresh().catch(reason => setError(reason instanceof Error ? reason.message : '알림을 불러오지 못했습니다.')); }, []);

  async function openNotification(item: NotificationRow) {
    if (!item.readAt) {
      const response = await fetch('/api/notifications', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: [item.id] }) });
      if (response.ok) { setNotifications(items => items.map(current => current.id === item.id ? { ...current, readAt: new Date().toISOString() } : current)); setUnreadCount(count => Math.max(0, count - 1)); }
    }
    setOpen(false); router.push(item.href);
  }
  async function markAllRead() {
    const response = await fetch('/api/notifications', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ all: true }) });
    if (response.ok) { setNotifications(items => items.map(item => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))); setUnreadCount(0); }
  }

  return <div className="notification-menu"><button type="button" className="icon-button notification" aria-label={`알림 ${unreadCount}개`} aria-expanded={open} onClick={() => { setOpen(value => !value); if (!open) refresh().catch(reason => setError(reason instanceof Error ? reason.message : '알림을 불러오지 못했습니다.')); }}>🔔{unreadCount > 0 && <i/>}</button>{open && <div className="notification-popover"><div className="notification-heading"><b>알림</b><span>{unreadCount > 0 && <button onClick={markAllRead}>모두 읽음</button>} <Link href="/settings/notifications" onClick={() => setOpen(false)}>설정</Link></span></div>{error && <p role="alert">{error}</p>}{notifications.length ? notifications.map(item => <button type="button" className={`notification-row${item.readAt ? '' : ' unread'}`} key={item.id} onClick={() => openNotification(item)}><b>{item.title}</b><span>{item.body}</span><time>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time></button>) : <p className="notification-empty">새 알림이 없습니다.</p>}</div>}</div>;
}
