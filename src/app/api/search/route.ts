import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/server/data-source';
import { Project, ProjectMember, Task } from '@/server/entities';
import { jsonError, requireUser } from '@/server/http';

export async function GET(request: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;
  const query = request.nextUrl.searchParams.get('q')?.trim().slice(0, 100) ?? '';
  if (query.length < 2) return NextResponse.json({ projects: [], tasks: [] });
  const escaped = query.replace(/[!%_]/g, character => `!${character}`);
  const needle = `%${escaped}%`;
  try {
    const db = await getDataSource();
    const projectQuery = db.getRepository(Project).createQueryBuilder('project')
      .select(['project.id', 'project.name', 'project.status'])
      .where('project.archivedAt IS NULL AND (project.name LIKE :needle ESCAPE \'!\' OR project.description LIKE :needle ESCAPE \'!\')', { needle })
      .orderBy('project.updatedAt', 'DESC').take(8);
    const taskQuery = db.getRepository(Task).createQueryBuilder('task')
      .innerJoin(Project, 'project', 'project.id = task.projectId')
      .select(['task.id', 'task.title', 'task.status', 'task.projectId'])
      .addSelect('project.name', 'projectName')
      .where('task.archivedAt IS NULL AND project.archivedAt IS NULL AND (task.title LIKE :needle ESCAPE \'!\' OR task.description LIKE :needle ESCAPE \'!\')', { needle })
      .orderBy('task.updatedAt', 'DESC').take(10);
    if (user!.role !== 'ADMIN') {
      projectQuery.innerJoin(ProjectMember, 'projectMembership', 'projectMembership.projectId = project.id AND projectMembership.userId = :userId', { userId: user!.id });
      taskQuery.innerJoin(ProjectMember, 'taskMembership', 'taskMembership.projectId = task.projectId AND taskMembership.userId = :userId', { userId: user!.id });
    }
    const [projects, taskRows] = await Promise.all([projectQuery.getMany(), taskQuery.getRawAndEntities()]);
    const tasks = taskRows.entities.map((task, index) => ({ id: task.id, title: task.title, status: task.status, projectId: task.projectId, projectName: taskRows.raw[index]?.projectName ?? '' }));
    return NextResponse.json({ projects, tasks });
  } catch (error) { return jsonError(error); }
}
