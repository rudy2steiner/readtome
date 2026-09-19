import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export { schema };
export type Database = DrizzleD1Database<typeof schema>;

type D1Binding = Parameters<typeof drizzle>[0];

let cached: Database | undefined;

function binding(env: Record<string, unknown>): D1Binding | undefined {
  return env.DB as D1Binding | undefined;
}

/**
 * D1 is a Worker binding, not an env URL. Missing in `next build`; present in `next dev`
 * (via initOpenNextCloudflareForDev) and on the deployed Worker.
 */
export async function db(): Promise<Database | null> {
  if (cached) return cached;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const d1 = binding(env as Record<string, unknown>);
    if (!d1) return null;
    cached = drizzle(d1, { schema });
    return cached;
  } catch {
    return null;
  }
}
