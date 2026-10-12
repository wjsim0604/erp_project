import ProjectsClient from './projects-client';
import Link from 'next/link';
export default function ProjectsPage() { return <main className="module-page"><header><div><Link href="/">← 대시보드</Link><h1>프로젝트</h1><p>접근 권한이 있는 프로젝트를 확인하고 새 프로젝트를 만들 수 있습니다.</p></div></header><ProjectsClient/></main>; }
