import { randomUUID } from 'node:crypto';
import { getDataSource } from './data-source';
import { Notification, NotificationPreference, User } from './entities';

const preferenceFields: Record<string, { inApp: keyof NotificationPreference; email: keyof NotificationPreference }> = {
  task_assigned: { inApp: 'taskAssignedInApp', email: 'taskAssignedEmail' },
  report_submitted: { inApp: 'reportSubmittedInApp', email: 'reportSubmittedEmail' },
  report_comment: { inApp: 'reportCommentInApp', email: 'reportCommentEmail' },
};

export async function notifyUser(input: Pick<Notification, 'userId' | 'kind' | 'title' | 'body' | 'href'>) {
  const db = await getDataSource();
  const fields = preferenceFields[input.kind];
  const preference = fields ? await db.getRepository(NotificationPreference).findOneBy({ userId: input.userId }) : null;
  if (!fields || !preference || preference[fields.inApp]) {
    const repo = db.getRepository(Notification);
    await repo.save(repo.create({ id: randomUUID(), ...input, readAt: null }));
  }
  const webhook = process.env.NOTIFICATION_WEBHOOK_URL;
  if (fields && preference?.[fields.email] && webhook) {
    const account = await db.getRepository(User).findOne({ where: { id: input.userId, active: true } });
    if (account) {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (process.env.NOTIFICATION_WEBHOOK_TOKEN) headers.authorization = `Bearer ${process.env.NOTIFICATION_WEBHOOK_TOKEN}`;
      const response = await fetch(webhook, { method: 'POST', headers, body: JSON.stringify({ to: account.email, subject: input.title, text: input.body, href: input.href }), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`Notification webhook returned ${response.status}`);
    }
  }
}
