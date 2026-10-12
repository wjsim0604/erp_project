import { NextResponse } from 'next/server';
import { getDataSource } from '@/server/data-source';
import { User } from '@/server/entities';
import { jsonError, requireUser } from '@/server/http';

export async function GET() {
  const { response } = await requireUser(['ADMIN']); if (response) return response;
  try {
    const users = await (await getDataSource()).getRepository(User).find({ select: { id: true, email: true, displayName: true, role: true, active: true, createdAt: true }, order: { createdAt: 'DESC' } });
    return NextResponse.json({ users });
  } catch (error) { return jsonError(error); }
}
