import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'ok';
  let dbLatencyMs = 0;

  try {
    const supabase = createAdminClient();
    const dbStart = Date.now();
    const { error } = await supabase.from('time_slots').select('id').limit(1);
    dbLatencyMs = Date.now() - dbStart;

    if (error) {
      dbStatus = `error: ${error.message}`;
    }
  } catch (err: any) {
    dbStatus = `exception: ${err.message}`;
  }

  const isHealthy = dbStatus === 'ok';

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      latency_ms: Date.now() - startTime,
      database: {
        status: dbStatus,
        latency_ms: dbLatencyMs,
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
