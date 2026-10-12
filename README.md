# Flow ERP

Next.js and TypeScript application for the AI-assisted work and project management ERP MVP.

## Stack

- Next.js App Router and TypeScript
- MySQL 8 with TypeORM; schema synchronization is disabled
- Tailwind CSS
- Auth.js Credentials login with bcrypt password hashes and 8-hour JWT sessions
- API-side role and project membership checks for project, task, report and invitation operations

## Run locally

1. Install Node.js 20 or later and MySQL 8.
2. Copy `.env.example` to `.env.local` and set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and a random `AUTH_SECRET`. Set `MFA_ENCRYPTION_KEY` to a separately backed-up base64 32-byte key before enabling administrator MFA. Set `UPLOAD_DIR` to a durable private path in production.
3. Create the database named by `DB_NAME` using `utf8mb4`.
4. Run `npm install`, then `npm run migration:show` to inspect pending changes and `npm run migration:run` to apply them.
5. Create the first administrator with `npm run admin:create` (the command accepts credentials interactively and only works when no account exists).
6. Run `npm run dev` and open `http://localhost:3000`; `GET /api/health` reports the web process status.

Database migrations are deliberately explicit. Use `npm run migration:generate -- src/server/migrations/DescribeYourChange` to generate a schema diff, or `npm run migration:create -- src/server/migrations/DescribeYourChange` for a blank migration. Review the generated `up` and `down` methods, then run `npm run migration:show` and `npm run migration:run`. `npm run migration:revert` runs the last migration's `down` method. Take and verify a database backup before production changes; MySQL DDL may commit implicitly, so a failed migration may need a forward repair even when a `down` method exists. Never enable TypeORM `synchronize` in a deployed environment. Migrations are tracked in `typeorm_migrations`. The initial migration covers users, teams, invitations, projects, memberships, tasks, daily reports, report items, and audit logs.

## Implemented API

- `GET/POST /api/projects` lists projects visible to the current user and creates a project for an admin or manager.
- `GET/POST /api/projects/:projectId/tasks` lists or creates tasks inside an accessible project.
- `PATCH /api/tasks/:taskId` restricts members to updating their own assigned task status/description; managers can edit task fields.
- `GET/PUT /api/reports/:reportDate` reads or saves the signed-in user's daily report and linked items.
- `GET/POST /api/reports/:reportDate/comments` lets report owners, administrators and authorized project managers read and add review comments.
- `GET /api/reports?date=YYYY-MM-DD` gives administrators all reports; project managers see only report items linked to projects they manage, without access to employees' unrelated daily summary fields.
- `GET /api/projects/:projectId/activity` shows recent project and task audit events to project members.
- `GET /api/search?q=...` searches projects and tasks visible to the signed-in user.
- `GET/PATCH /api/notifications` lists personal notifications and marks them read.
- `GET/POST /api/admin/security/mfa` reports and updates administrator TOTP enrollment. Admin login requires an authenticator or one-time recovery code after MFA is enabled.
- `GET/POST /api/projects/:projectId/documents` lists or uploads private project documents; `GET/DELETE /api/projects/:projectId/documents/:documentId` downloads or removes one. Uploads are limited to 10 MB and PDF, TXT, CSV, PNG, JPG, DOCX, XLSX and PPTX. Files are stored outside `public` under `UPLOAD_DIR` (default `.private-uploads`); use a durable private shared volume for multi-instance deployments.
- `POST /api/invitations` creates a 48-hour, single-use invite URL for an administrator to share.
- `POST /api/invitations/accept` accepts a valid invite and creates the account.
- `POST /api/ai/report-draft` turns a user-provided note into an unpersisted report suggestion when an OpenAI-compatible provider is configured.

Invitations are not emailed automatically. The administrator must share the returned one-time URL using an approved channel.

## Planned delivery slices

1. Dashboard data loading and basic project/task/report flows are available; richer task field editing remains planned.
2. Project document upload/download and PDF/image previews, report comments, project activity timelines and project-scoped manager report review are available. Managers can review only items linked to projects where they have the project manager role.
3. Search, notifications, AI suggestions with source text and human approval are available; broader notification preferences and delivery channels remain planned.
4. Administrator TOTP MFA, persistent login throttling, sensitive API request limits and deployment/backup/restore runbook are available. Automated delivery pipelines, operational alerting and recovery exercises remain planned.

AI suggestions must remain drafts until a user reviews and applies them. The report helper sends only the note entered for that request to the configured `AI_API_URL`; it does not send employee, team, project, or database data. Keep provider credentials server-side. Configure `AI_API_URL`, `AI_API_KEY`, and `AI_MODEL` only after the organization's provider and retention policy are approved. If these settings are blank, the AI endpoint returns `503` and manual reporting remains available.

See [OPERATIONS.md](./OPERATIONS.md) for deployment, backup and restore steps.
