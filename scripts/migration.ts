import { loadEnvConfig } from '@next/env';
import { MigrationExecutor } from 'typeorm';
import { AppDataSource, assertDatabaseSettings } from '../src/server/data-source';

async function main() {
  loadEnvConfig(process.cwd());
  assertDatabaseSettings();
  const action = process.argv[2];
  if (!['show', 'run', 'revert'].includes(action)) throw new Error('Use migration action: show, run, or revert.');
  await AppDataSource.initialize();
  try {
    if (action === 'show') {
      const executor = new MigrationExecutor(AppDataSource);
      const [executed, pending] = await Promise.all([executor.getExecutedMigrations(), executor.getPendingMigrations()]);
      console.log(`Applied migrations (${executed.length}):`);
      for (const migration of executed) console.log(`  [applied] ${migration.name}`);
      console.log(`Pending migrations (${pending.length}):`);
      for (const migration of pending) console.log(`  [pending] ${migration.name}`);
      if (executed.length === 0 && pending.length === 0) console.log('  No migration files were found.');
    } else if (action === 'run') {
      const applied = await AppDataSource.runMigrations();
      if (!applied.length) console.log('Database schema is already up to date.');
      else for (const migration of applied) console.log(`Applied ${migration.name}`);
    } else {
      const executed = await new MigrationExecutor(AppDataSource).getExecutedMigrations();
      const latest = executed.sort((left, right) => right.timestamp - left.timestamp)[0];
      if (!latest) console.log('There are no migrations to revert.');
      else {
        await AppDataSource.undoLastMigration();
        console.log(`Reverted ${latest.name}`);
      }
    }
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Migration command failed.');
  process.exitCode = 1;
});
