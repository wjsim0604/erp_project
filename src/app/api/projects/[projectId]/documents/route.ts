import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { IsNull } from 'typeorm';
import { getDataSource } from '@/server/data-source';
import { Project, ProjectDocument, ProjectMember, User } from '@/server/entities';
import { jsonError, requireUser } from '@/server/http';
import { allowedDocumentTypes, MAX_PROJECT_DOCUMENT_BYTES, projectDocumentPath, safeOriginalName } from '@/server/project-documents';
import { recordAudit } from '@/server/audit';
import { checkRateLimit } from '@/server/rate-limit';

type Context = { params: { projectId: string } };
export const runtime = 'nodejs';

async function getAccess(projectId: string, userId: string, role: string) {
  const db = await getDataSource();
  const project = await db.getRepository(Project).findOne({ where: { id: projectId, archivedAt: IsNull() } });
  if (!project) return { db, membership: null, found: false };
  const membership = await db.getRepository(ProjectMember).findOne({ where: { projectId, userId } });
  return { db, membership, found: role === 'ADMIN' || !!membership };
}

export async function GET(_request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser();
  if (response) return response;
  try {
    const { db, membership, found } = await getAccess(params.projectId, user!.id, user!.role);
    if (!found) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    const documents = await db.getRepository(ProjectDocument).createQueryBuilder('document')
      .innerJoin(User, 'uploader', 'uploader.id = document.uploadedBy')
      .select('document.id', 'id').addSelect('document.originalName', 'originalName')
      .addSelect('document.mimeType', 'mimeType').addSelect('document.fileSize', 'fileSize')
      .addSelect('document.createdAt', 'createdAt').addSelect('uploader.displayName', 'uploaderName')
      .where('document.projectId = :projectId', { projectId: params.projectId })
      .orderBy('document.createdAt', 'DESC').getRawMany();
    return NextResponse.json({ documents, canUpload: user!.role === 'ADMIN' || membership?.projectRole !== 'VIEWER', canManage: user!.role === 'ADMIN' || membership?.projectRole === 'MANAGER' });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  const { user, response } = await requireUser(['ADMIN', 'MANAGER', 'MEMBER']);
  if (response) return response;
  if (!(await checkRateLimit(user!.id, 'project.document-upload', 30, 86400))) return NextResponse.json({ error: '오늘 올릴 수 있는 파일 수를 초과했습니다.' }, { status: 429, headers: { 'Retry-After': '86400' } });
  try {
    const declaredSize = Number(request.headers.get('content-length') ?? 0);
    if (declaredSize > MAX_PROJECT_DOCUMENT_BYTES + 128 * 1024) return NextResponse.json({ error: '파일은 10MB 이하여야 합니다.' }, { status: 413 });
    const { db, membership, found } = await getAccess(params.projectId, user!.id, user!.role);
    if (!found) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    if (user!.role !== 'ADMIN' && membership?.projectRole === 'VIEWER') return NextResponse.json({ error: '문서를 올릴 권한이 없습니다.' }, { status: 403 });
    const form = await request.formData();
    const value = form.get('file');
    if (!(value instanceof File)) return NextResponse.json({ error: '업로드할 파일을 선택해 주세요.' }, { status: 400 });
    if (value.size < 1 || value.size > MAX_PROJECT_DOCUMENT_BYTES) return NextResponse.json({ error: '파일은 1바이트 이상 10MB 이하여야 합니다.' }, { status: 413 });
    const originalName = safeOriginalName(value.name);
    const extension = path.extname(originalName).toLowerCase();
    const mimeType = Object.entries(allowedDocumentTypes).find(([, extensions]) => extensions.includes(extension))?.[0];
    if (!mimeType) return NextResponse.json({ error: 'PDF, TXT, CSV, PNG, JPG, DOCX, XLSX, PPTX 파일만 올릴 수 있습니다.' }, { status: 415 });
    const id = randomUUID();
    const filePath = projectDocumentPath(id);
    const root = path.dirname(filePath);
    await mkdir(root, { recursive: true, mode: 0o700 });
    const bytes = Buffer.from(await value.arrayBuffer());
    if (bytes.byteLength !== value.size) return NextResponse.json({ error: '파일을 읽지 못했습니다.' }, { status: 400 });
    await writeFile(filePath, bytes, { flag: 'wx', mode: 0o600 });
    try {
      const repository = db.getRepository(ProjectDocument);
      const document = await repository.save(repository.create({ id: randomUUID(), projectId: params.projectId, uploadedBy: user!.id, originalName, storageName: id, mimeType, fileSize: value.size }));
      await recordAudit({ actorId: user!.id, action: 'project.document_upload', targetType: 'project', targetId: params.projectId, metadata: { documentId: document.id, name: originalName, size: value.size } });
      return NextResponse.json({ document: { id: document.id, originalName, mimeType, fileSize: value.size, createdAt: document.createdAt } }, { status: 201 });
    } catch (error) {
      await db.getRepository(ProjectDocument).delete({ storageName: id }).catch(() => undefined);
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  } catch (error) { return jsonError(error); }
}
