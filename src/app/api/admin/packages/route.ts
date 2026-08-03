import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminSessionFromRequest, sanitizeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = getAdminSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    const { data: packages, error } = await adminSupabase
      .from('user_packages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: true, packages: [] });
    }

    return NextResponse.json({ success: true, packages: packages || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = getAdminSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'Missing id or status' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { data: updatedPkg, error } = await adminSupabase
      .from('user_packages')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, package: updatedPkg });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
