import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Self-healing for databases that predate part of the schema.
 *
 * An install upgraded in place — a Docker volume from before the restaurant
 * release, or a bare `npm run start` that never ran `prisma db push` — has a
 * working hotel but no MenuCategory/FoodOrder tables, so every restaurant
 * query fails with Prisma error P2021 until someone intervenes. Rather than
 * leaving the module dead, the API routes call {@link healMissingTables} when
 * they see that error: it runs the bundled Prisma CLI once to push the schema,
 * after which the caller retries.
 */

/** Prisma's "the table does not exist in the current database" error. */
export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  if (code === 'P2021') return true;
  const message = error instanceof Error ? error.message : '';
  return message.includes('does not exist in the current database') || message.includes('no such table');
}

/** One push per process, no matter how many requests hit the error at once. */
let healing: Promise<boolean> | null = null;

export function healMissingTables(): Promise<boolean> {
  healing ??= runDbPush().finally(() => {
    // Allow another attempt on a later request if this one failed.
    setTimeout(() => { healing = null; }, 30_000);
  });
  return healing;
}

async function runDbPush(): Promise<boolean> {
  const { spawnSync } = await import('child_process');

  // Dev and `npm run start` resolve from the repo root; the Docker image
  // copies both the CLI and prisma/ next to server.js, which is the cwd.
  const roots = [process.cwd(), join(process.cwd(), '..'), '/app'];
  const cli = roots.map((root) => join(root, 'node_modules/prisma/build/index.js')).find(existsSync);
  const schema = roots.map((root) => join(root, 'prisma/schema.prisma')).find(existsSync);

  if (!cli || !schema) {
    console.error(
      'Schema heal: prisma CLI or schema not found. Run `npx prisma db push` against this database manually.',
    );
    return false;
  }

  console.warn('Schema heal: tables missing from the database, running prisma db push…');
  const result = spawnSync(
    process.execPath,
    [cli, 'db', 'push', '--skip-generate', '--accept-data-loss', `--schema=${schema}`],
    { timeout: 120_000, encoding: 'utf8' },
  );

  if (result.status === 0) {
    console.warn('Schema heal: database schema is now up to date.');
    return true;
  }
  console.error('Schema heal: prisma db push failed:', result.stderr || result.stdout || result.error);
  return false;
}
