/**
 * Ágata María · Probador virtual con IA — Backend (Cloudflare Worker)
 * --------------------------------------------------------------------
 * Motor: IDM-VTON (modelo abierto) vía el Space de Hugging Face — GRATIS.
 * Sube la foto + la prenda al Space, ejecuta el try-on y devuelve la imagen.
 * Guarda el REGISTRO DE CONSENTIMIENTO (Ley 1581) en D1. No archiva fotos.
 *
 * Bindings esperados:
 *   - HF_TOKEN        (secret)  → token gratuito de Hugging Face (hf_...)
 *   - DB              (D1)      → registro de consentimientos + rate limit
 *   - ALLOWED_ORIGINS (var)     → dominios autorizados separados por comas
 */

const SPACE = "https://yisol-idm-vton.hf.space";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const RATE_LIMIT = 5;               // generaciones por IP por hora

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

export default {
  async fetch(request, env) {
    const cors = resolveCors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "Método no permitido" }, 405, cors);

    try {
      const body = await request.json();
      const { photo, garmentImage, productHandle, productTitle, consent, marketingOptIn } = body;

      if (consent !== true) return json({ error: "Falta la autorización de tratamiento de datos." }, 400, cors);
      if (!photo || !photo.startsWith("data:image/")) return json({ error: "Foto inválida." }, 400, cors);
      if (!garmentImage) return json({ error: "Falta la imagen del producto." }, 400, cors);
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

      const auth = { "Authorization": `Bearer ${env.HF_TOKEN}` };

      // 1 · Subir la foto de la persona y la prenda al Space
      const personBlob = dataUrlToBlob(photo);
      const garmentResp = await fetch(garmentImage);
      if (!garmentResp.ok) return json({ error: "No se pudo leer la imagen del producto." }, 502, cors);
      const garmentBlob = await garmentResp.blob();

      const personPath = await hfUpload(personBlob, "persona.jpg", auth);
      const garmentPath = await hfUpload(garmentBlob, "prenda.jpg", auth);
      if (!personPath || !garmentPath) return json({ error: "No se pudo subir la imagen al servidor de IA." }, 502, cors);

      // 2 · Llamar a /tryon
      const payload = {
        data: [
          { background: fileData(personPath), layers: [], composite: null },
          fileData(garmentPath),
          productTitle || "prenda de moda",
          true,   // auto-mask
          true,   // auto-crop
          20,     // denoise steps
          42,     // seed
        ],
      };
      const callResp = await fetch(`${SPACE}/call/tryon`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!callResp.ok) {
        const d = await callResp.text();
        return json({ error: "El servidor de IA rechazó la solicitud.", detail: d.slice(0, 300) }, 502, cors);
      }
      const { event_id } = await callResp.json();
      if (!event_id) return json({ error: "No se obtuvo id de la tarea de IA." }, 502, cors);

      // 3 · Leer el resultado (SSE)
      const resResp = await fetch(`${SPACE}/call/tryon/${event_id}`, { headers: auth });
      const stream = await resResp.text();
      const outUrl = parseGradioResult(stream);
      if (!outUrl) return json({ error: "La IA no devolvió imagen (puede estar saturada, reintenta).", detail: stream.slice(-300) }, 502, cors);

      // 4 · Traer la imagen final y devolverla como data URI
      const finalUrl = outUrl.startsWith("http") ? outUrl : `${SPACE}/file=${outUrl}`;
      const imgResp = await fetch(finalUrl, { headers: auth });
      const buf = await imgResp.arrayBuffer();
      const mime = imgResp.headers.get("Content-Type") || "image/png";
      return json({ ok: true, id, image: `data:${mime};base64,${arrayBufferToBase64(buf)}` }, 200, cors);

    } catch (err) {
      return json({ error: "Error interno.", detail: String(err) }, 500, cors);
    }
  },
};

/* ---------- helpers ---------- */
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors } });
}

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const mime = dataUrl.slice(5, dataUrl.indexOf(";")) || "image/jpeg";
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function hfUpload(blob, filename, auth) {
  const fd = new FormData();
  fd.append("files", blob, filename);
  const r = await fetch(`${SPACE}/upload`, { method: "POST", headers: auth, body: fd });
  if (!r.ok) return null;
  const arr = await r.json();
  return Array.isArray(arr) ? arr[0] : null;
}

function fileData(path) {
  return { path, url: `${SPACE}/file=${path}`, orig_name: path.split("/").pop(), meta: { _type: "gradio.FileData" } };
}

function parseGradioResult(sse) {
  // Busca el último bloque "event: complete" con su línea "data: [...]"
  const lines = sse.split("\n");
  let lastData = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("data:")) lastData = lines[i].slice(5).trim();
  }
  if (!lastData) return null;
  try {
    const arr = JSON.parse(lastData);
    const first = Array.isArray(arr) ? arr[0] : arr;
    if (first && typeof first === "object") return first.url || first.path || null;
    if (typeof first === "string") return first;
  } catch (e) {}
  return null;
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
