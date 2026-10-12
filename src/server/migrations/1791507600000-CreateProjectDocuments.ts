import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectDocuments1791507600000 implements MigrationInterface {
  name = 'CreateProjectDocuments1791507600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE project_documents (
      id varchar(36) NOT NULL, project_id varchar(36) NOT NULL, uploaded_by varchar(36) NOT NULL,
      original_name varchar(255) NOT NULL, storage_name varchar(80) NOT NULL, mime_type varchar(120) NOT NULL,
      file_size int unsigned NOT NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id), UNIQUE KEY uq_project_documents_storage_name (storage_name), KEY ix_project_documents_project_time (project_id,created_at),
      CONSTRAINT fk_project_documents_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_project_documents_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE project_documents');
  }
}
