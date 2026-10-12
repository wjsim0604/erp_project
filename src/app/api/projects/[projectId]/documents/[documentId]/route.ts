import { unlink, readFile } from 'node:fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { IsNull } from 'typeorm';
import { getDataSource } from '@/server/data-source';
import { Project, ProjectDocument, ProjectMember } from '@/server/entities';
import { jsonError, requireUser } from '@/server/http';
import { projectDocumentPath } from '@/server/project-documents';
import { recordAudit } from '@/server/audit';

type Context = { params: { projectId: string; documentId: string } };
export const runtime = 'nodejs';

async function loadAccessibleDocument(projectId: string, documentId: string, userId: string, role: string) {
  const db = await getDataSource();
  const document = await db.getRepository(ProjectDocument).findOne({ where: { id: documentId, projectId } });
  if (!document) return { db, document: null, membership: null, allowed: false };
  const project = await db.getRepository(Project).findOne({ where: { id: projectId, archivedAt: IsNull() } });
  const membership = await db.getRepository(ProjectMember).findOne({ where: { projectId, userId } });
  return { db, document, membership, allowed: !!project && (role === 'ADMIN' || !!membership) };
}

export async function GET(request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser();
  if (response) return response;
  try {
    const { document, allowed } = await loadAccessibleDocument(params.projectId, params.documentId, user!.id, user!.role);
    if (!document || !allowed) return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    const filePath = projectDocumentPath(document.storageName);
    const bytes = await readFile(filePath);
    const safeFallback = document.originalName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    const preview = request.nextUrl.searchParams.get('preview') === '1' && ['application/pdf', 'image/png', 'image/jpeg'].includes(document.mimeType);
    return new NextResponse(bytes, { headers: {
      'Content-Type': document.mimeType,
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `${preview ? 'inline' : 'attachment'}; filename="${safeFallback}"; filename*=UTF-8''${encodeURIComponent(document.originalName).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    } });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser();
  if (response) return response;
  try {
    const { db, document, membership, allowed } = await loadAccessibleDocument(params.projectId, params.documentId, user!.id, user!.role);
    if (!document || !allowed) return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    if (user!.role !== 'ADMIN' && membership?.projectRole !== 'MANAGER') return NextResponse.json({ error: '문서를 제거할 권한이 없습니다.' }, { status: 403 });
    await db.getRepository(ProjectDocument).delete({ id: document.id });
    await unlink(projectDocumentPath(document.storageName)).catch(() => undefined);
    await recordAudit({ actorId: user!.id, action: 'project.document_delete', targetType: 'project', targetId: params.projectId, metadata: { documentId: document.id, name: document.originalName } });
    return NextResponse.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
