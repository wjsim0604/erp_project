import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, DeleteDateColumn } from 'typeorm';

export type UserRole = 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

@Entity('users')
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 254 }) email!: string;
  @Column({ name: 'display_name', length: 100 }) displayName!: string;
  @Column({ name: 'password_hash', select: false, length: 255 }) passwordHash!: string;
  @Column({ type: 'enum', enum: ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'], default: 'MEMBER' }) role!: UserRole;
  @Column({ name: 'mfa_enabled', type: 'boolean', default: false }) mfaEnabled!: boolean;
  @Column({ name: 'mfa_secret', type: 'varchar', length: 512, nullable: true, select: false }) mfaSecret!: string | null;
  @Column({ name: 'mfa_pending_secret', type: 'varchar', length: 512, nullable: true, select: false }) mfaPendingSecret!: string | null;
  @Column({ name: 'mfa_recovery_codes', type: 'text', nullable: true, select: false }) mfaRecoveryCodes!: string | null;
  @Column({ default: true }) active!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 }) updatedAt!: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 6, nullable: true }) deletedAt!: Date | null;
}

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 120 }) name!: string;
  @Column({ type: 'varchar', nullable: true, length: 500 }) description!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt!: Date;
}

@Entity('team_memberships')
@Index(['teamId', 'userId'], { unique: true })
export class TeamMembership {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'team_id', type: 'varchar', length: 36 }) teamId!: string;
  @Column({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  @Column({ name: 'team_role', type: 'enum', enum: ['LEAD', 'MEMBER'], default: 'MEMBER' }) teamRole!: 'LEAD' | 'MEMBER';
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt!: Date;
}

@Entity('projects')
@Index(['status', 'archivedAt'])
export class Project {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 160 }) name!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'enum', enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED'], default: 'PLANNING' }) status!: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate!: string | null;
  @Column({ name: 'due_date', type: 'date', nullable: true }) dueDate!: string | null;
  @Column({ name: 'owner_id', type: 'varchar', length: 36 }) ownerId!: string;
  @Column({ name: 'archived_at', type: 'datetime', precision: 6, nullable: true }) archivedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 }) updatedAt!: Date;
}

@Entity('project_members')
@Index(['projectId', 'userId'], { unique: true })
export class ProjectMember {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'project_id', type: 'varchar', length: 36 }) projectId!: string;
  @Column({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  @Column({ name: 'project_role', type: 'enum', enum: ['MANAGER', 'MEMBER', 'VIEWER'], default: 'MEMBER' }) projectRole!: 'MANAGER' | 'MEMBER' | 'VIEWER';
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt!: Date;
}

@Entity('invitations')
@Index(['email', 'tokenHash'], { unique: true })
export class Invitation {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 254 }) email!: string;
  @Column({ name: 'token_hash', length: 64 }) tokenHash!: string;
  @Column({ name: 'role', type: 'enum', enum: ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'], default: 'MEMBER' }) role!: UserRole;
  @Column({ name: 'invited_by', type: 'varchar', length: 36 }) invitedBy!: string;
  @Column({ name: 'expires_at', type: 'datetime', precision: 6 }) expiresAt!: Date;
  @Column({ name: 'accepted_at', type: 'datetime', precision: 6, nullable: true }) acceptedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt!: Date;
}

@Entity('tasks')
@Index(['projectId', 'status', 'dueDate'])
@Index(['assigneeId', 'status'])
export class Task {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'project_id', type: 'varchar', length: 36 }) projectId!: string;
  @Column({ length: 200 }) title!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ name: 'assignee_id', type: 'varchar', length: 36, nullable: true }) assigneeId!: string | null;
  @Column({ type: 'enum', enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'], default: 'TODO' }) status!: TaskStatus;
  @Column({ type: 'enum', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' }) priority!: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate!: string | null;
  @Column({ name: 'due_date', type: 'date', nullable: true }) dueDate!: string | null;
  @Column({ name: 'created_by', type: 'varchar', length: 36 }) createdBy!: string;
  @Column({ name: 'archived_at', type: 'datetime', precision: 6, nullable: true }) archivedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 }) updatedAt!: Date;
}

@Entity('daily_reports')
@Index(['userId', 'reportDate'], { unique: true })
export class DailyReport {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  @Column({ name: 'report_date', type: 'date' }) reportDate!: string;
  @Column({ type: 'text', nullable: true }) summary!: string | null;
  @Column({ type: 'text', nullable: true }) blockers!: string | null;
  @Column({ name: 'next_plan', type: 'text', nullable: true }) nextPlan!: string | null;
  @Column({ name: 'source_note', type: 'text', nullable: true }) sourceNote!: string | null;
  @Column({ type: 'enum', enum: ['DRAFT', 'SUBMITTED'], default: 'DRAFT' }) status!: 'DRAFT' | 'SUBMITTED';
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 }) updatedAt!: Date;
}

@Entity('report_items')
export class ReportItem {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'report_id', type: 'varchar', length: 36 }) reportId!: string;
  @Column({ name: 'project_id', type: 'varchar', length: 36, nullable: true }) projectId!: string | null;
  @Column({ name: 'task_id', type: 'varchar', length: 36, nullable: true }) taskId!: string | null;
  @Column({ type: 'enum', enum: ['COMPLETED', 'IN_PROGRESS', 'BLOCKED', 'NEXT'] }) category!: 'COMPLETED' | 'IN_PROGRESS' | 'BLOCKED' | 'NEXT';
  @Column({ type: 'text' }) content!: string;
  @Column({ type: 'enum', enum: ['USER', 'AI_SUGGESTION'], default: 'USER' }) source!: 'USER' | 'AI_SUGGESTION';
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt!: Date;
}

@Entity('report_comments')
@Index(['reportId', 'createdAt'])
export class ReportComment {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'report_id', type: 'varchar', length: 36 }) reportId!: string;
  @Column({ name: 'author_id', type: 'varchar', length: 36 }) authorId!: string;
  @Column({ type: 'text' }) content!: string;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt!: Date;
}

@Entity('project_documents')
@Index(['projectId', 'createdAt'])
export class ProjectDocument {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'project_id', type: 'varchar', length: 36 }) projectId!: string;
  @Column({ name: 'uploaded_by', type: 'varchar', length: 36 }) uploadedBy!: string;
  @Column({ name: 'original_name', length: 255 }) originalName!: string;
  @Column({ name: 'storage_name', length: 80, unique: true }) storageName!: string;
  @Column({ name: 'mime_type', length: 120 }) mimeType!: string;
  @Column({ name: 'file_size', type: 'int', unsigned: true }) fileSize!: number;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt!: Date;
}

@Entity('notifications')
@Index(['userId', 'readAt', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  @Column({ type: 'varchar', length: 40 }) kind!: string;
  @Column({ length: 200 }) title!: string;
  @Column({ type: 'text' }) body!: string;
  @Column({ length: 500 }) href!: string;
  @Column({ name: 'read_at', type: 'datetime', precision: 6, nullable: true }) readAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt!: Date;
}

@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryColumn({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  @Column({ name: 'task_assigned_in_app', type: 'boolean', default: true }) taskAssignedInApp!: boolean;
  @Column({ name: 'report_submitted_in_app', type: 'boolean', default: true }) reportSubmittedInApp!: boolean;
  @Column({ name: 'report_comment_in_app', type: 'boolean', default: true }) reportCommentInApp!: boolean;
  @Column({ name: 'task_assigned_email', type: 'boolean', default: false }) taskAssignedEmail!: boolean;
  @Column({ name: 'report_submitted_email', type: 'boolean', default: false }) reportSubmittedEmail!: boolean;
  @Column({ name: 'report_comment_email', type: 'boolean', default: false }) reportCommentEmail!: boolean;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 }) updatedAt!: Date;
}

@Entity('auth_login_attempts')
@Index(['emailHash', 'createdAt'])
export class AuthLoginAttempt {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'email_hash', type: 'char', length: 64 }) emailHash!: string;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt!: Date;
}

@Entity('api_request_limits')
export class ApiRequestLimit {
  @PrimaryColumn({ name: 'bucket_key', type: 'char', length: 64 }) bucketKey!: string;
  @Column({ name: 'window_started', type: 'datetime', precision: 6 }) windowStarted!: Date;
  @Column({ name: 'hit_count', type: 'int', unsigned: true }) hitCount!: number;
}

@Entity('audit_logs')
@Index(['actorId', 'createdAt'])
@Index(['targetType', 'targetId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'actor_id', type: 'varchar', length: 36, nullable: true }) actorId!: string | null;
  @Column({ name: 'action', length: 80 }) action!: string;
  @Column({ name: 'target_type', length: 80 }) targetType!: string;
  @Column({ name: 'target_id', type: 'varchar', length: 36, nullable: true }) targetId!: string | null;
  @Column({ name: 'request_id', type: 'varchar', length: 100, nullable: true }) requestId!: string | null;
  @Column({ type: 'json', nullable: true }) metadata!: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt!: Date;
}
