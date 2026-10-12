import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { loadEnvConfig } from '@next/env';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { getDataSource } from '../src/server/data-source';
import { User } from '../src/server/entities';

async function main() {
  loadEnvConfig(process.cwd());
  const missing = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'].filter(key => !process.env[key]?.trim());
  if (process.env.DB_PASSWORD === undefined) missing.push('DB_PASSWORD');
  if (missing.length) throw new Error(`Set ${missing.join(', ')} in .env.local before creating the first administrator.`);
  const rl = readline.createInterface({ input, output });
  try {
    const email = (await rl.question('Administrator email: ')).trim().toLowerCase();
    const displayName = (await rl.question('Display name: ')).trim();
    const password = await rl.question('Password (12+ characters): ');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName || password.length < 12 || password.length > 128) throw new Error('Enter a valid email, name, and password of 12 to 128 characters.');
    const dataSource = await getDataSource();
    try {
      if (await dataSource.getRepository(User).count() > 0) throw new Error('An account already exists. Use an existing administrator to invite users.');
      await dataSource.getRepository(User).insert({ id: randomUUID(), email, displayName, passwordHash: await hash(password, 12), role: 'ADMIN', active: true });
      console.log(`Created administrator ${email}.`);
    } finally { await dataSource.destroy(); }
  } finally { rl.close(); }
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Failed to create administrator.'); process.exitCode = 1; });
