const REDACT_HEADER = /authorization|cookie|set-cookie|stripe-signature/i;
const REDACT_FIELD = /^(token|code|state|signature|client_secret|access_token|id_token|refresh_token|secret|api[_-]?key)$/i;
const MAX_STRING = 400;

export function logCall(name: string, req: unknown, res: unknown, extra?: { ms?: number; status?: number }): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      call: name,
      ...(extra?.ms != null ? { ms: extra.ms } : {}),
      ...(extra?.status != null ? { status: extra.status } : {}),
      req: sanitize(req),
      res: sanitize(res),
    }),
  );
}

export async function loggedFetch(name: string, url: string, init?: RequestInit): Promise<Response> {
  const started = Date.now();
  const req = {
    method: init?.method ?? 'GET',
    url,
    headers: headerRecord(init?.headers),
    body: parseBody(init?.body),
  };
  try {
    const response = await fetch(url, init);
    logCall(name, req, await summarizeResponse(response.clone()), { ms: Date.now() - started, status: response.status });
    return response;
  } catch (error) {
    logCall(name, req, { error: errorMessage(error) }, { ms: Date.now() - started });
    throw error;
  }
}

export function withApiLog<Req extends Request, Ctx = unknown>(
  name: string,
  handler: (req: Req, ctx: Ctx) => Promise<Response>,
) {
  return async (req: Req, ctx: Ctx) => {
    const started = Date.now();
    const reqSummary = await summarizeRequest(req.clone());
    try {
      const response = await handler(req, ctx);
      logCall(name, reqSummary, await summarizeResponse(response.clone()), {
        ms: Date.now() - started,
        status: response.status,
      });
      return response;
    } catch (error) {
      logCall(name, reqSummary, { error: errorMessage(error) }, { ms: Date.now() - started });
      throw error;
    }
  };
}

export function sanitize(value: unknown, key = ''): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return summarizeString(key, value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof ArrayBuffer) return { _kind: 'bytes', length: value.byteLength };
  if (ArrayBuffer.isView(value)) return { _kind: 'bytes', length: value.byteLength };
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.slice(0, 20).map((item, index) => sanitize(item, String(index)));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [field, nested] of Object.entries(value as Record<string, unknown>)) {
      out[field] = REDACT_FIELD.test(field) || REDACT_HEADER.test(field) ? '[redacted]' : sanitize(nested, field);
    }
    return out;
  }
  return String(value);
}

async function summarizeRequest(req: Request): Promise<Record<string, unknown>> {
  const url = new URL(req.url);
  return {
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    body: await readBody(req),
  };
}

async function summarizeResponse(res: Response): Promise<Record<string, unknown>> {
  return { status: res.status, body: await readBody(res) };
}

async function readBody(source: Request | Response): Promise<unknown> {
  const contentType = source.headers.get('content-type') || '';
  if (source instanceof Request && (source.method === 'GET' || source.method === 'HEAD')) return undefined;
  if (contentType.includes('json')) {
    try {
      return await source.json();
    } catch {
      return '[unreadable-json]';
    }
  }
  if (contentType.includes('text') || contentType.includes('urlencoded') || contentType.includes('json')) {
    const text = await source.text();
    return summarizeString('body', text);
  }
  if (!contentType) {
    try {
      const text = await source.text();
      return text ? summarizeString('body', text) : undefined;
    } catch {
      return undefined;
    }
  }
  const bytes = (await source.arrayBuffer()).byteLength;
  return { _kind: 'body', contentType, bytes };
}

function parseBody(body: BodyInit | null | undefined): unknown {
  if (body == null) return undefined;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return summarizeString('body', body);
    }
  }
  if (body instanceof ArrayBuffer) return { _kind: 'bytes', length: body.byteLength };
  if (ArrayBuffer.isView(body)) return { _kind: 'bytes', length: body.byteLength };
  return { _kind: typeof body };
}

function headerRecord(headers?: HeadersInit): Record<string, string> | undefined {
  if (!headers) return undefined;
  const out: Record<string, string> = {};
  new Headers(headers).forEach((value, key) => {
    out[key] = REDACT_HEADER.test(key) ? '[redacted]' : value;
  });
  return Object.keys(out).length ? out : undefined;
}

function summarizeString(key: string, value: string): unknown {
  if (REDACT_FIELD.test(key) || REDACT_HEADER.test(key)) return '[redacted]';
  if (key === 'audio' || (value.length > 2000 && /^[A-Za-z0-9+/=\s]+$/.test(value))) {
    return { _kind: 'base64', length: value.length };
  }
  if (value.length > MAX_STRING) return `${value.slice(0, MAX_STRING)}…(${value.length} chars)`;
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
