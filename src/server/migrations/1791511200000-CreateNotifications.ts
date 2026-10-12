import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1791511200000 implements MigrationInterface {
  name = 'CreateNotifications1791511200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE notifications (
      id varchar(36) NOT NULL, user_id varchar(36) NOT NULL, kind varchar(40) NOT NULL,
      title varchar(200) NOT NULL, body text NOT NULL, href varchar(500) NOT NULL,
      read_at datetime(6) NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id), KEY ix_notifications_user_read_time (user_id,read_at,created_at),
      CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE notifications');
  }
}
