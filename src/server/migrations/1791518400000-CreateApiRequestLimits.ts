import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApiRequestLimits1791518400000 implements MigrationInterface {
  name = 'CreateApiRequestLimits1791518400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE api_request_limits (
      bucket_key char(64) NOT NULL, window_started datetime(6) NOT NULL,
      hit_count int unsigned NOT NULL, PRIMARY KEY (bucket_key), KEY ix_api_request_limits_window (window_started)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE api_request_limits');
  }
}
