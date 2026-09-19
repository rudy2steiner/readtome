export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function jsonError(error: string, status = 400, extra?: Record<string, unknown>): Response {
  return Response.json({ error, ...extra }, { status });
}
