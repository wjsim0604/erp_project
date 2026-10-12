import { getDataSource } from './data-source';
import { DailyReport, Project, ProjectMember, Task, UserRole } from './entities';

const todayInSeoul = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export async function getDashboardData(userId: string, role: UserRole) {
  const db = await getDataSource();
  const today = todayInSeoul();
  const taskQuery = db.getRepository(Task).createQueryBuilder('task')
    .innerJoin(Project, 'project', 'project.id = task.projectId')
    .select(['task.id', 'task.title', 'task.description', 'task.status', 'task.priority', 'task.dueDate', 'task.updatedAt'])
    .addSelect('project.name', 'projectName')
    .where('task.assigneeId = :userId AND task.status <> :done AND task.archivedAt IS NULL', { userId, done: 'DONE' })
    .orderBy('task.dueDate', 'ASC').addOrderBy('task.updatedAt', 'DESC').take(8);
  if (role !== 'ADMIN') taskQuery.innerJoin(ProjectMember, 'membership', 'membership.projectId = task.projectId AND membership.userId = :userId', { userId });
  const [taskRows, projectQuery, report] = await Promise.all([
    taskQuery.getRawAndEntities(),
    (() => {
      const query = db.getRepository(Project).createQueryBuilder('project').where('project.archivedAt IS NULL AND project.status <> :completed', { completed: 'COMPLETED' }).orderBy('project.updatedAt', 'DESC').take(4);
      if (role !== 'ADMIN') query.innerJoin(ProjectMember, 'membership', 'membership.projectId = project.id AND membership.userId = :userId', { userId });
      return query.getMany();
    })(),
    db.getRepository(DailyReport).findOne({ where: { userId, reportDate: today } }),
  ]);
  const assignedQuery = () => {
    const query = db.getRepository(Task).createQueryBuilder('task').where('task.assigneeId = :userId AND task.status <> :done AND task.archivedAt IS NULL', { userId, done: 'DONE' });
    if (role !== 'ADMIN') query.innerJoin(ProjectMember, 'membership', 'membership.projectId = task.projectId AND membership.userId = :userId', { userId });
    return query;
  };
  const [dueToday, overdue] = await Promise.all([
    assignedQuery().andWhere('task.dueDate = :today', { today }).getCount(),
    assignedQuery().andWhere('task.dueDate < :today', { today }).getCount(),
  ]);
  const tasks = taskRows.entities.map((task, i) => ({ id: task.id, title: task.title, status: task.status, priority: task.priority, dueDate: task.dueDate, projectName: taskRows.raw[i]?.projectName ?? '' }));
  const projectIds = projectQuery.map(project => project.id);
  let progress = new Map<string, { total: number; done: number }>();
  if (projectIds.length) {
    const counts = await db.getRepository(Task).createQueryBuilder('task').select('task.projectId', 'projectId').addSelect('COUNT(*)', 'total').addSelect("SUM(task.status = 'DONE')", 'done').where('task.projectId IN (:...projectIds) AND task.archivedAt IS NULL', { projectIds }).groupBy('task.projectId').getRawMany();
    progress = new Map(counts.map((row: { projectId: string; total: string; done: string | null }) => [row.projectId, { total: Number(row.total), done: Number(row.done ?? 0) }]));
  }
  return {
    today,
    tasks,
    dueToday,
    overdue,
    reportSubmitted: report?.status === 'SUBMITTED',
    projects: projectQuery.map(project => {
      const counts = progress.get(project.id) ?? { total: 0, done: 0 };
      return { id: project.id, name: project.name, status: project.status, dueDate: project.dueDate, progress: counts.total ? Math.round(counts.done / counts.total * 100) : 0 };
    }),
  };
}
