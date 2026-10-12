import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1727222400000 implements MigrationInterface {
  name = 'InitialSchema1727222400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE users (
      id varchar(36) NOT NULL, email varchar(254) NOT NULL, display_name varchar(100) NOT NULL,
      password_hash varchar(255) NOT NULL, role enum('ADMIN','MANAGER','MEMBER','VIEWER') NOT NULL DEFAULT 'MEMBER',
      active tinyint NOT NULL DEFAULT 1, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), deleted_at datetime(6) NULL,
      PRIMARY KEY (id), UNIQUE KEY uq_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE teams (
      id varchar(36) NOT NULL, name varchar(120) NOT NULL, description varchar(500) NULL,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE team_memberships (
      id varchar(36) NOT NULL, team_id varchar(36) NOT NULL, user_id varchar(36) NOT NULL,
      team_role enum('LEAD','MEMBER') NOT NULL DEFAULT 'MEMBER', created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id), UNIQUE KEY uq_team_membership (team_id,user_id), KEY ix_team_memberships_user (user_id),
      CONSTRAINT fk_team_membership_team FOREIGN KEY (team_id) REFERENCES teams(id),
      CONSTRAINT fk_team_membership_user FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE projects (
      id varchar(36) NOT NULL, name varchar(160) NOT NULL, description text NULL,
      status enum('PLANNING','ACTIVE','ON_HOLD','COMPLETED') NOT NULL DEFAULT 'PLANNING', start_date date NULL, due_date date NULL,
      owner_id varchar(36) NOT NULL, archived_at datetime(6) NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (id),
      KEY ix_projects_status_archived (status,archived_at), KEY ix_projects_owner (owner_id),
      CONSTRAINT fk_projects_owner FOREIGN KEY (owner_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE project_members (
      id varchar(36) NOT NULL, project_id varchar(36) NOT NULL, user_id varchar(36) NOT NULL,
      project_role enum('MANAGER','MEMBER','VIEWER') NOT NULL DEFAULT 'MEMBER', created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id), UNIQUE KEY uq_project_member (project_id,user_id), KEY ix_project_members_user (user_id),
      CONSTRAINT fk_project_member_project FOREIGN KEY (project_id) REFERENCES projects(id),
      CONSTRAINT fk_project_member_user FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE invitations (
      id varchar(36) NOT NULL, email varchar(254) NOT NULL, token_hash char(64) NOT NULL,
      role enum('ADMIN','MANAGER','MEMBER','VIEWER') NOT NULL DEFAULT 'MEMBER', invited_by varchar(36) NOT NULL,
      expires_at datetime(6) NOT NULL, accepted_at datetime(6) NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id), UNIQUE KEY uq_invitation_email_token (email,token_hash), KEY ix_invitations_expires (expires_at),
      CONSTRAINT fk_invitations_invited_by FOREIGN KEY (invited_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE tasks (
      id varchar(36) NOT NULL, project_id varchar(36) NOT NULL, title varchar(200) NOT NULL, description text NULL,
      assignee_id varchar(36) NULL, status enum('TODO','IN_PROGRESS','IN_REVIEW','DONE') NOT NULL DEFAULT 'TODO',
      priority enum('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM', start_date date NULL, due_date date NULL,
      created_by varchar(36) NOT NULL, archived_at datetime(6) NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (id),
      KEY ix_tasks_project_status_due (project_id,status,due_date), KEY ix_tasks_assignee_status (assignee_id,status),
      CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects(id),
      CONSTRAINT fk_tasks_assignee FOREIGN KEY (assignee_id) REFERENCES users(id),
      CONSTRAINT fk_tasks_creator FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE daily_reports (
      id varchar(36) NOT NULL, user_id varchar(36) NOT NULL, report_date date NOT NULL, summary text NULL, blockers text NULL, next_plan text NULL, source_note text NULL,
      status enum('DRAFT','SUBMITTED') NOT NULL DEFAULT 'DRAFT', created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (id),
      UNIQUE KEY uq_daily_report_user_date (user_id,report_date),
      CONSTRAINT fk_daily_reports_user FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE report_items (
      id varchar(36) NOT NULL, report_id varchar(36) NOT NULL, project_id varchar(36) NULL, task_id varchar(36) NULL,
      category enum('COMPLETED','IN_PROGRESS','BLOCKED','NEXT') NOT NULL, content text NOT NULL,
      source enum('USER','AI_SUGGESTION') NOT NULL DEFAULT 'USER', created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id), KEY ix_report_items_report (report_id), KEY ix_report_items_project (project_id), KEY ix_report_items_task (task_id),
      CONSTRAINT fk_report_items_report FOREIGN KEY (report_id) REFERENCES daily_reports(id),
      CONSTRAINT fk_report_items_project FOREIGN KEY (project_id) REFERENCES projects(id),
      CONSTRAINT fk_report_items_task FOREIGN KEY (task_id) REFERENCES tasks(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE audit_logs (
      id varchar(36) NOT NULL, actor_id varchar(36) NULL, action varchar(80) NOT NULL, target_type varchar(80) NOT NULL,
      target_id varchar(36) NULL, request_id varchar(100) NULL, metadata json NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id), KEY ix_audit_actor_time (actor_id,created_at), KEY ix_audit_target (target_type,target_id),
      CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE audit_logs');
    await queryRunner.query('DROP TABLE report_items');
    await queryRunner.query('DROP TABLE daily_reports');
    await queryRunner.query('DROP TABLE tasks');
    await queryRunner.query('DROP TABLE invitations');
    await queryRunner.query('DROP TABLE project_members');
    await queryRunner.query('DROP TABLE projects');
    await queryRunner.query('DROP TABLE team_memberships');
    await queryRunner.query('DROP TABLE teams');
    await queryRunner.query('DROP TABLE users');
  }
}
