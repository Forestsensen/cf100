import { NextRequest, NextResponse } from 'next/server';

import { getAdminRoleFromRequest } from '@/lib/admin-auth';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const role = await getAdminRoleFromRequest(request);

  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ role });
}
