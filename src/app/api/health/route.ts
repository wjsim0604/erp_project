import { NextResponse } from 'next/server';
import { getDataSource } from '@/server/data-source';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await (await getDataSource()).query('SELECT 1');
    return NextResponse.json({ status: 'ok', service: 'flow-erp', checks: { database: 'ok' }, timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: 'error', service: 'flow-erp', checks: { database: 'error' }, timestamp: new Date().toISOString() }, { status: 503 });
  }
}
