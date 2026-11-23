import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    return Response.json(
      { status: 'error', db: String(err) },
      { status: 500 }
    );
  }
}
