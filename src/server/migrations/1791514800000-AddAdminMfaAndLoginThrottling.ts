import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminMfaAndLoginThrottling1791514800000 implements MigrationInterface {
  name = 'AddAdminMfaAndLoginThrottling1791514800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users
      ADD COLUMN mfa_enabled tinyint NOT NULL DEFAULT 0,
      ADD COLUMN mfa_secret varchar(512) NULL,
      ADD COLUMN mfa_pending_secret varchar(512) NULL`);
    await queryRunner.query(`CREATE TABLE auth_login_attempts (
      id varchar(36) NOT NULL, email_hash char(64) NOT NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id), KEY ix_auth_login_attempts_email_time (email_hash,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE auth_login_attempts');
    await queryRunner.query('ALTER TABLE users DROP COLUMN mfa_pending_secret, DROP COLUMN mfa_secret, DROP COLUMN mfa_enabled');
  }
}
