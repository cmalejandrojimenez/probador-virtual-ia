/**
 * Probador virtual con IA — Backend serverless (Cloudflare Worker)
 * Motor PREMIUM: fal.ai FASHN try-on. Portable a cualquier CMS.
 * ---------------------------------------------------------------
 * El navegador hace POST con: { photo (dataURI), garmentImage (URL https),
 *   productHandle, productTitle, consent (true), marketingOptIn }.
 * El Worker valida consentimiento + rate-limit + CORS, registra el
 * consentimiento en D1 (prueba habeas data), llama a fal y devuelve la imagen.
 *
 * Bindings/secretos en Cloudflare:
 *   - FAL_KEY         (secret)  -> clave de fal.ai
 *   - DB              (D1)      -> registro de consentimientos + rate limit
 *   - ALLOWED_ORIGINS (var)     -> dominios autorizados, separados por coma
 */

const FAL_MODEL = "fal-ai/fashn/tryon/v1.5";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const RATE_LIMIT = 8;               // generaciones por IP por hora

let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.exec("CREATE TABLE IF NOT EXISTS consentimientos (id TEXT PRIMARY KEY, fecha TEXT NOT NULL, ip TEXT, user_agent TEXT, producto TEXT, marketing_opt_in INTEGER DEFAULT 0, finalidad TEXT)");
  await env.DB.exec("CREATE TABLE IF NOT EXISTS rate_limit (k TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)");
  schemaReady = true;
}

function resolveCors(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const reqOrigin = request.headers.get("Origin") || "";
  const ok = allowed.length === 0 ? "*" : (allowed.includes(reqOrigin) ? reqOrigin : (allowed[0] || "*"));
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

// LECCIÓN CLAVE: muchos CMS devuelven URLs protocolo-relativas (//cdn.../x.jpg).
// fal las rechaza ("Invalid image. Expecting a valid URL."). Normalizar SIEMPRE.
function normalizeUrl(u) {
  if (!u) return u;
  u = String(u).trim();
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("http://")) return "https://" + u.slice(7);
  return u;
}

export default {
  async fetch(request, env) {
    const cors = resolveCors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "Método no permitido" }, 405, cors);

    try {
      const body = await request.json();
      const { photo, productHandle, productTitle, consent, marketingOptIn } = body;
      const garmentImage = normalizeUrl(body.garmentImage);

      if (consent !== true) return json({ error: "Falta la autorización de tratamiento de datos." }, 400, cors);
      if (!photo || !photo.startsWith("data:image/")) return json({ error: "Foto inválida." }, 400, cors);
      if (!garmentImage || !/^https:\/\//.test(garmentImage)) return json({ error: "Falta una URL válida (https) de la prenda." }, 400, cors);
      const approxBytes = (photo.length - photo.indexOf(",") - 1) * 0.75;
      if (approxBytes > MAX_BYTES) return json({ error: "La foto supera los 10 MB." }, 413, cors);

      await ensureSchema(env);

      const ip = request.headers.get("CF-Connecting-IP") || "anon";
      const rl = await rateLimit(env, ip);
      if (!rl.ok) return json({ error: "Has alcanzado el límite de pruebas por hora. Intenta más tarde." }, 429, cors);

      const id = crypto.randomUUID();
      const fecha = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO consentimientos (id, fecha, ip, user_agent, producto, marketing_opt_in, finalidad)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, fecha, ip, request.headers.get("User-Agent") || "",
        productHandle || productTitle || "", marketingOptIn === true ? 1 : 0,
        "Generar vista previa con IA del producto en la usuaria").run();

      const falResp = await fetch(`https://fal.run/${FAL_MODEL}`, {
        method: "POST",
        headers: { "Authorization": `Key ${env.FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model_image: photo, garment_image: garmentImage, category: "auto" }),
      });
      if (!falResp.ok) {
        const detail = await falResp.text();
        return json({ error: "No se pudo generar la imagen.", detail: detail.slice(0, 300) }, 502, cors);
      }
      const result = await falResp.json();
      const outUrl = result && result.images && result.images[0] && result.images[0].url;
      if (!outUrl) return json({ error: "La IA no devolvió imagen." }, 502, cors);

      const genImg = await fetch(outUrl);
      const genBuf = await genImg.arrayBuffer();
      const mime = genImg.headers.get("Content-Type") || "image/jpeg";
      return json({ ok: true, id, image: `data:${mime};base64,${arrayBufferToBase64(genBuf)}` }, 200, cors);

    } catch (err) {
      return json({ error: "Error interno.", detail: String(err) }, 500, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors } });
}
function arrayBufferToBase64(buf) {
  let binary = ""; const bytes = new Uint8Array(buf); const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(binary);
}
async function rateLimit(env, ip) {
  const hora = new Date().toISOString().slice(0, 13);
  const key = `${ip}|${hora}`;
  const row = await env.DB.prepare(`SELECT n FROM rate_limit WHERE k = ?`).bind(key).first();
  const n = row ? row.n : 0;
  if (n >= RATE_LIMIT) return { ok: false };
  await env.DB.prepare(`INSERT INTO rate_limit (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1`).bind(key).run();
  return { ok: true };
}
