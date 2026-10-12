import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMfaRecoveryCodes1791522000000 implements MigrationInterface {
  name = 'AddMfaRecoveryCodes1791522000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users ADD COLUMN mfa_recovery_codes text NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users DROP COLUMN mfa_recovery_codes');
  }
}
