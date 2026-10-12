import { NextRequest, NextResponse } from 'next/server';
import { In } from 'typeorm';
import { z } from 'zod';
import { getDataSource } from '@/server/data-source';
import { DailyReport, ProjectMember, ReportItem, User } from '@/server/entities';
import { jsonError, requireUser } from '@/server/http';

export async function GET(request: NextRequest) {
  const { user, response } = await requireUser(['ADMIN', 'MANAGER']);
  if (response) return response;
  const parsedDate = z.string().date().safeParse(request.nextUrl.searchParams.get('date'));
  if (!parsedDate.success) return NextResponse.json({ error: '조회할 날짜를 YYYY-MM-DD 형식으로 지정해 주세요.' }, { status: 400 });
  try {
    const db = await getDataSource();
    const isAdmin = user!.role === 'ADMIN';
    let projectIds: string[] = [];
    if (!isAdmin) {
      const managedProjects = await db.getRepository(ProjectMember).find({ where: { userId: user!.id, projectRole: 'MANAGER' }, select: { projectId: true } });
      projectIds = managedProjects.map(item => item.projectId);
      if (!projectIds.length) return NextResponse.json({ date: parsedDate.data, scope: 'PROJECTS', employees: [] });
    }
    let reports: DailyReport[];
    let employees: User[];
    if (isAdmin) {
      [employees, reports] = await Promise.all([
        db.getRepository(User).find({ select: { id: true, displayName: true, email: true, role: true, active: true }, order: { displayName: 'ASC' } }),
        db.getRepository(DailyReport).find({ where: { reportDate: parsedDate.data }, order: { updatedAt: 'DESC' } }),
      ]);
    } else {
      const linked = await db.getRepository(ReportItem).createQueryBuilder('item')
        .innerJoin(DailyReport, 'report', 'report.id = item.reportId')
        .select('item.reportId', 'reportId').distinct(true)
        .where('report.reportDate = :date AND item.projectId IN (:...projectIds)', { date: parsedDate.data, projectIds }).getRawMany<{ reportId: string }>();
      const reportIds = linked.map(row => row.reportId);
      if (!reportIds.length) return NextResponse.json({ date: parsedDate.data, scope: 'PROJECTS', employees: [] });
      reports = await db.getRepository(DailyReport).find({ where: { id: In(reportIds) }, order: { updatedAt: 'DESC' } });
      const reportUserIds = [...new Set(reports.map(report => report.userId))];
      employees = await db.getRepository(User).find({ where: { id: In(reportUserIds) }, select: { id: true, displayName: true, email: true, role: true, active: true }, order: { displayName: 'ASC' } });
    }
    const reportIds = reports.map(report => report.id);
    const items = reportIds.length ? await db.getRepository(ReportItem).find({ where: isAdmin ? { reportId: In(reportIds) } : { reportId: In(reportIds), projectId: In(projectIds) }, order: { createdAt: 'ASC' } }) : [];
    const itemsByReport = new Map<string, ReportItem[]>();
    for (const item of items) itemsByReport.set(item.reportId, [...(itemsByReport.get(item.reportId) ?? []), item]);
    const reportsByUser = new Map(reports.map(report => [report.userId, report]));
    return NextResponse.json({ date: parsedDate.data, scope: isAdmin ? 'ALL' : 'PROJECTS', employees: employees.map(employee => {
      const report = reportsByUser.get(employee.id);
      if (!report) return { employee: { id: employee.id, name: employee.displayName, email: employee.email, role: employee.role, active: employee.active }, report: null };
      const linkedItems = itemsByReport.get(report.id) ?? [];
      return { employee: { id: employee.id, name: employee.displayName, email: employee.email, role: employee.role, active: employee.active }, report: isAdmin ? { ...report, items: linkedItems } : { ...report, summary: null, blockers: null, nextPlan: null, sourceNote: null, items: linkedItems } };
    }) });
  } catch (error) { return jsonError(error); }
}
