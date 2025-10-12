export const config = { runtime: "edge" };

export default function handler() {
  const body = {
    ok: true,
    capability: "health",
    data: { status: "ok", now: new Date().toISOString() }
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}
