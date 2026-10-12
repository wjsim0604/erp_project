import { redirect } from 'next/navigation';
import { requireUser } from '@/server/http';
import UsersClient from './users-client';
import Link from 'next/link';
export default async function UsersPage() { const { user } = await requireUser(); if (!user) redirect('/login'); if (user.role !== 'ADMIN') redirect('/'); return <main className="module-page"><header><div><Link href="/">← 대시보드</Link><h1>직원 및 권한 관리</h1><p>직원을 초대하고 계정 역할과 사용 상태를 관리합니다.</p></div></header><UsersClient/></main>; }
