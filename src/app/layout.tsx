import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: '워크스페이스 | Flow ERP', description: '팀 업무와 프로젝트를 한곳에서 관리합니다.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap"/></head><body>{children}</body></html>;
}
