import { and, count, desc, eq, ne } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { findCloudVoice } from './voices';

const TEXT_CAP = 200_000;
const REPLAY_GAP_MS = 120_000;

export type ListenPart = {
  index: number;
  cacheKey: string;
  seconds: number;
  duration?: number;
  cached: boolean;
};

export function parseListenParts(raw: string | null | undefined): ListenPart[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ListenPart => {
        if (!item || typeof item !== 'object') return false;
        const part = item as ListenPart;
        return typeof part.cacheKey === 'string' && Number.isFinite(part.index);
      })
      .map((part) => ({
        index: Number(part.index),
        cacheKey: part.cacheKey,
        seconds: Number(part.seconds) || 0,
        duration: Number(part.duration) || 0,
        cached: Boolean(part.cached),
      }))
      .sort((left, right) => left.index - right.index);
  } catch {
    return [];
  }
}

export function listenAudioKeys(row: { parts?: string | null }): string[] {
  return parseListenParts(row.parts).map((part) => part.cacheKey);
}

export async function rememberListen(input: {
  userUuid: string;
  sessionKey: string;
  text: string;
  voiceId: string;
  part?: ListenPart;
}): Promise<void> {
  const database = await db();
  if (!database) return;

  const now = new Date();
  const text = input.text.replace(/\u0000/g, '').slice(0, TEXT_CAP);
  try {
    await writeListen(database, { ...input, text, now });
  } catch (error) {
    try {
      await writeListen(database, { ...input, text, now });
    } catch (retry) {
      console.error(JSON.stringify({ call: 'tts.listen.remember', error: String(retry ?? error) }));
    }
  }
}

async function writeListen(
  database: NonNullable<Awaited<ReturnType<typeof db>>>,
  input: {
    userUuid: string;
    sessionKey: string;
    text: string;
    voiceId: string;
    part?: ListenPart;
    now: Date;
  },
): Promise<void> {
  const [existing] = await database
    .select()
    .from(schema.listens)
    .where(and(eq(schema.listens.userUuid, input.userUuid), eq(schema.listens.cacheKey, input.sessionKey)))
    .limit(1);

  const parts = parseListenParts(existing?.parts);
  if (input.part && !parts.some((part) => part.index === input.part!.index || part.cacheKey === input.part!.cacheKey)) {
    parts.push(input.part);
    parts.sort((left, right) => left.index - right.index);
  }

  const seconds = parts.reduce((sum, part) => sum + (part.duration || part.seconds), 0);
  const cached = parts.length > 0 && parts.every((part) => part.cached);
  const text = input.text.length >= (existing?.text.length ?? 0) ? input.text : existing!.text;
  if (!text && parts.length === 0) return;

  const lastHeard = existing?.lastHeardAt ? new Date(existing.lastHeardAt).getTime() : 0;
  const playCount = existing ? (input.now.getTime() - lastHeard > REPLAY_GAP_MS ? existing.playCount + 1 : existing.playCount) : 1;

  if (!existing) {
    await database.insert(schema.listens).values({
      userUuid: input.userUuid,
      cacheKey: input.sessionKey,
      text,
      voiceId: input.voiceId,
      seconds,
      cached,
      playCount,
      createdAt: input.now,
      lastHeardAt: input.now,
      parts: JSON.stringify(parts),
    });
    return;
  }

  await database
    .update(schema.listens)
    .set({
      text,
      voiceId: input.voiceId,
      seconds,
      cached,
      playCount,
      lastHeardAt: input.now,
      parts: JSON.stringify(parts),
    })
    .where(eq(schema.listens.uuid, existing.uuid));
}

export const CLIP_PAGE_SIZES = [10, 20, 50] as const;
export const CLIP_DEFAULT_SIZE = 10;

export function clipPageSize(value: unknown): number {
  const size = Number(value);
  return CLIP_PAGE_SIZES.includes(size as (typeof CLIP_PAGE_SIZES)[number]) ? size : CLIP_DEFAULT_SIZE;
}

export function clipPage(value: unknown, pages: number): number {
  const page = Math.floor(Number(value));
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, Math.max(pages, 1));
}

export async function listUserListens(userUuid: string, paging?: { page?: unknown; size?: unknown }) {
  const empty = { items: [], total: 0, page: 1, size: CLIP_DEFAULT_SIZE, pages: 1 };
  const database = await db();
  if (!database) return empty;

  const where = and(eq(schema.listens.userUuid, userUuid), ne(schema.listens.parts, '[]'));
  const [totalRow] = await database.select({ n: count() }).from(schema.listens).where(where);
  const total = totalRow?.n ?? 0;
  const size = clipPageSize(paging?.size);
  const pages = Math.max(1, Math.ceil(total / size));
  const page = clipPage(paging?.page, pages);

  const rows = await database
    .select()
    .from(schema.listens)
    .where(where)
    .orderBy(desc(schema.listens.lastHeardAt))
    .limit(size)
    .offset((page - 1) * size);

  const items = rows.flatMap((row) => {
    const parts = parseListenParts(row.parts);
    if (parts.length === 0) return [];
    const voice = findCloudVoice(row.voiceId);
    return [
      {
        id: row.uuid,
        text: row.text,
        voiceId: row.voiceId,
        voiceName: voice?.name ?? row.voiceId,
        seconds: parts.reduce((sum, part) => sum + (part.duration || part.seconds), 0),
        chargedSeconds: parts.reduce((sum, part) => sum + (part.cached ? 0 : part.duration || part.seconds), 0),
        cached: parts.length > 0 ? parts.every((part) => part.cached) : row.cached,
        playCount: row.playCount,
        partCount: parts.length,
        createdAt: row.createdAt.toISOString(),
        lastHeardAt: row.lastHeardAt.toISOString(),
      },
    ];
  });

  return { items, total, page, size, pages };
}

export async function getUserListen(userUuid: string, listenId: string) {
  const database = await db();
  if (!database) return null;
  const [row] = await database
    .select()
    .from(schema.listens)
    .where(and(eq(schema.listens.uuid, listenId), eq(schema.listens.userUuid, userUuid)))
    .limit(1);
  return row ?? null;
}
