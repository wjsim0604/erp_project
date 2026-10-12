import 'reflect-metadata';
import { loadEnvConfig } from '@next/env';
import { DataSource } from 'typeorm';
import { ApiRequestLimit, AuditLog, AuthLoginAttempt, DailyReport, Invitation, Notification, NotificationPreference, Project, ProjectDocument, ProjectMember, ReportComment, ReportItem, Task, Team, TeamMembership, User } from './entities';

loadEnvConfig(process.cwd());
const requiredDatabaseSettings = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'] as const;
export function assertDatabaseSettings() {
  const missing = requiredDatabaseSettings.filter(key => process.env[key] === undefined || (key !== 'DB_PASSWORD' && process.env[key]?.trim() === ''));
  if (missing.length) throw new Error(`Missing MySQL settings: ${missing.join(', ')}`);
  if (!Number.isInteger(Number(process.env.DB_PORT)) || Number(process.env.DB_PORT) < 1 || Number(process.env.DB_PORT) > 65535) throw new Error('DB_PORT must be a valid TCP port.');
}

export const AppDataSource = new DataSource({
  type: 'mysql', host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER ?? 'erp_user', password: process.env.DB_PASSWORD ?? '', database: process.env.DB_NAME ?? 'work_erp',
  timezone: 'Z', charset: 'utf8mb4',
  entities: [User, Team, TeamMembership, Invitation, Notification, NotificationPreference, Project, ProjectDocument, ProjectMember, Task, DailyReport, ReportItem, ReportComment, AuthLoginAttempt, ApiRequestLimit, AuditLog],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false, migrationsRun: false, logging: process.env.NODE_ENV === 'development' ? ['error', 'schema'] : ['error'],
});

let source: Promise<DataSource> | undefined;
export function getDataSource() {
  assertDatabaseSettings();
  if (!source) source = AppDataSource.initialize().catch(error => { source = undefined; throw error; });
  return source;
}
