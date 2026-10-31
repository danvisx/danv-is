// Cloudflare serves static assets without Range support, and browsers need
// Range requests to seek inside audio. wrangler.jsonc routes only /music/* here;
// everything else is served as plain static files.

const RANGE = /^bytes=(\d*)-(\d*)$/;

export default {
  async fetch(request, env) {
    const headers = new Headers(request.headers);
    headers.delete('Range');
    let res = await env.ASSETS.fetch(new Request(request.url, { method: request.method, headers }));
    const m = RANGE.exec(request.headers.get('Range') ?? '');
    let size = Number(res.headers.get('Content-Length'));
    if (m && res.status === 200 && !size && request.method !== 'HEAD') {
      // No length given: read the file once to learn it.
      const buf = await res.arrayBuffer();
      size = buf.byteLength;
      res = new Response(buf, { status: 200, headers: res.headers });
    }

    const out = new Headers(res.headers);
    out.set('Accept-Ranges', 'bytes');
    if (res.status !== 200 || !m || (!m[1] && !m[2]) || !size) {
      return new Response(res.body, { status: res.status, headers: out });
    }

    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      res.body?.cancel();
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    out.set('Content-Range', `bytes ${start}-${end}/${size}`);
    out.set('Content-Length', String(end - start + 1));
    if (request.method === 'HEAD') {
      res.body?.cancel();
      return new Response(null, { status: 206, headers: out });
    }
    return new Response(slice(res.body, start, end), { status: 206, headers: out });
  },
};

// Streams bytes start..end (inclusive) out of body without buffering the file.
function slice(body, start, end) {
  const reader = body.getReader();
  let pos = 0;
  return new ReadableStream({
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return controller.close();
        const from = pos;
        pos += value.byteLength;
        if (pos <= start) continue;
        const chunk = value.subarray(Math.max(0, start - from), Math.min(value.byteLength, end + 1 - from));
        controller.enqueue(chunk);
        if (pos > end) {
          reader.cancel();
          controller.close();
        }
        return;
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}
