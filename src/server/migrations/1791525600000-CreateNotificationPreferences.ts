import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationPreferences1791525600000 implements MigrationInterface {
  name = 'CreateNotificationPreferences1791525600000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE notification_preferences (
      user_id varchar(36) NOT NULL PRIMARY KEY,
      task_assigned_in_app tinyint NOT NULL DEFAULT 1,
      report_submitted_in_app tinyint NOT NULL DEFAULT 1,
      report_comment_in_app tinyint NOT NULL DEFAULT 1,
      task_assigned_email tinyint NOT NULL DEFAULT 0,
      report_submitted_email tinyint NOT NULL DEFAULT 0,
      report_comment_email tinyint NOT NULL DEFAULT 0,
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE notification_preferences');
  }
}
