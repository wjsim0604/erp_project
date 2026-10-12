import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataSource } from '@/server/data-source';
import { Project, ProjectMember } from '@/server/entities';
import { jsonError, requireUser } from '@/server/http';
import { recordAudit } from '@/server/audit';

const projectInput = z.object({ name: z.string().trim().min(1).max(160), description: z.string().max(10000).optional(), status: z.enum(['PLANNING','ACTIVE','ON_HOLD','COMPLETED']).default('PLANNING'), startDate: z.string().date().nullable().optional(), dueDate: z.string().date().nullable().optional() });

export async function GET() {
  const { user, response } = await requireUser(); if (response) return response;
  try {
    const db = await getDataSource();
    const query = db.getRepository(Project).createQueryBuilder('project').where('project.archivedAt IS NULL').orderBy('project.updatedAt', 'DESC');
    if (user!.role !== 'ADMIN') query.innerJoin(ProjectMember, 'membership', 'membership.projectId = project.id AND membership.userId = :userId', { userId: user!.id });
    const projects = await query.getMany();
    return NextResponse.json({ projects });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(['ADMIN', 'MANAGER']); if (response) return response;
  const parsed = projectInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '프로젝트 정보를 확인해 주세요.', details: parsed.error.flatten() }, { status: 400 });
  try {
    const db = await getDataSource();
    const project = db.getRepository(Project).create({ id: randomUUID(), ...parsed.data, description: parsed.data.description ?? null, startDate: parsed.data.startDate ?? null, dueDate: parsed.data.dueDate ?? null, ownerId: user!.id });
    await db.transaction(async manager => {
      await manager.getRepository(Project).save(project);
      await manager.getRepository(ProjectMember).insert({ id: randomUUID(), projectId: project.id, userId: user!.id, projectRole: 'MANAGER' });
    });
    await recordAudit({ actorId: user!.id, action: 'project.create', targetType: 'project', targetId: project.id, metadata: { name: project.name } });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
