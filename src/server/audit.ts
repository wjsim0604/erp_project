import { randomUUID } from 'node:crypto';
import { getDataSource } from './data-source';
import { AuditLog } from './entities';

export async function recordAudit(input: Pick<AuditLog, 'actorId' | 'action' | 'targetType' | 'targetId' | 'metadata'> & { requestId?: string | null }) {
  const repository = (await getDataSource()).getRepository(AuditLog);
  await repository.save(repository.create({ id: randomUUID(), ...input, requestId: input.requestId ?? null }));
}
