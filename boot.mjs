import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';

async function bootstrapDatabase() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.warn('POSTGRES_URL not set; skipping automatic migration/seed.');
    return;
  }

  // Wait briefly for managed PostgreSQL container DNS/readiness
  let sql;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      sql = postgres(url, { max: 1, connect_timeout: 5 });
      await sql`SELECT 1`;
      break;
    } catch (err) {
      console.log(`Waiting for PostgreSQL (${attempt}/15):`, err.message);
      if (sql) await sql.end().catch(() => {});
      sql = null;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!sql) {
    console.error('Could not connect to PostgreSQL during bootstrap.');
    return;
  }

  try {
    const migPath = path.join(process.cwd(), 'lib/db/migrations/0000_soft_the_anarchist.sql');
    if (fs.existsSync(migPath)) {
      const raw = fs.readFileSync(migPath, 'utf8');
      const statements = raw
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        await sql.unsafe(stmt);
      }
    }

    const existing = await sql`SELECT COUNT(*)::int AS cnt FROM users`;
    if (existing[0]?.cnt === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      const [user] = await sql`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ('Demo Owner', 'test@test.com', ${passwordHash}, 'owner')
        RETURNING id`;
      const [team] = await sql`
        INSERT INTO teams (name, plan_name, subscription_status)
        VALUES ('Keterix SaaS Team', 'Plus', 'active')
        RETURNING id`;
      await sql`
        INSERT INTO team_members (user_id, team_id, role)
        VALUES (${user.id}, ${team.id}, 'owner')`;
      await sql`
        INSERT INTO activity_logs (team_id, user_id, action, ip_address)
        VALUES (${team.id}, ${user.id}, 'SIGN_UP', '127.0.0.1')`;
      console.log('Seeded initial demo user test@test.com and team.');
    }
  } catch (err) {
    console.error('Database bootstrap warning:', err);
  } finally {
    await sql.end().catch(() => {});
  }
}

await bootstrapDatabase();

process.env.HOSTNAME = '0.0.0.0';
process.env.PORT = process.env.PORT || '3000';
await import('./server.js');
