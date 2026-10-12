import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReportComments1791504000000 implements MigrationInterface {
  name = 'CreateReportComments1791504000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE report_comments (
      id varchar(36) NOT NULL, report_id varchar(36) NOT NULL, author_id varchar(36) NOT NULL,
      content text NOT NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id), KEY ix_report_comments_report_time (report_id,created_at),
      CONSTRAINT fk_report_comments_report FOREIGN KEY (report_id) REFERENCES daily_reports(id) ON DELETE CASCADE,
      CONSTRAINT fk_report_comments_author FOREIGN KEY (author_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE report_comments');
  }
}
