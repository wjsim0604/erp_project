import { randomBytes, randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { loadEnvConfig } from '@next/env';
import { getDataSource } from '../src/server/data-source';
import { User } from '../src/server/entities';

async function main() {
  loadEnvConfig(process.cwd());
  const email = 'admin@flowworks.local';
  const dataSource = await getDataSource();
  try {
    const users = dataSource.getRepository(User);
    if (await users.exist({ where: { email } })) {
      console.log(`The default account already exists: ${email}. No password was changed.`);
      return;
    }
    if (await users.count() > 0) {
      throw new Error('This database already has user accounts. Sign in as an administrator and invite a new account instead.');
    }
    const password = randomBytes(24).toString('base64url');
    await users.insert({ id: randomUUID(), email, displayName: '시스템 관리자', passwordHash: await hash(password, 12), role: 'ADMIN', active: true });
    console.log('Default administrator created. Save this password securely; it is shown only once.');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Failed to create the default administrator.');
  process.exitCode = 1;
});
