---
name: probador-virtual-ia
description: >
  Construir e instalar un "probador virtual" / try-on con inteligencia artificial
  en CUALQUIER CMS de ecommerce (Shopify, WooCommerce/WordPress, Webflow, Wix,
  Squarespace, o sitio custom). La clienta sube/toma una foto, autoriza el uso de
  datos personales (habeas data · Ley 1581 Colombia / GDPR), y una IA genera una
  imagen de ella vistiendo la prenda de esa página de producto. Úsala SIEMPRE que
  el usuario pida un "probador virtual", "try-on", "verse con la ropa puesta",
  "probarse la prenda con IA", un botón de cámara/foto en la PDP que genere una
  vista previa, o cuando mencione fal.ai/FASHN, IDM-VTON o Cloudflare Worker para
  moda. Entrega backend serverless, widget embebible configurable, copy de
  consentimiento y plantilla de política de datos, con pasos de inserción por CMS.
---

# Probador virtual con IA (try-on) para cualquier CMS

Sistema completo y portable para que una tienda ofrezca un **probador virtual**: la
usuaria carga una foto, **autoriza el tratamiento de datos**, y la IA devuelve una
imagen suya con la prenda de la página puesta.

La arquitectura está separada del CMS a propósito, así el **mismo backend y el mismo
widget** sirven para Shopify, WooCommerce, Webflow, Wix, Squarespace o un sitio
hecho a mano. Solo cambia **cómo se inserta el snippet** y **de dónde se lee la
imagen de la prenda**.

```
[Navegador de la clienta]
   foto (dataURI) + URL de la prenda + consentimiento
        |  HTTPS POST
        v
[Cloudflare Worker]  -- valida consentimiento, rate-limit, CORS
        |            -- registra el consentimiento en D1 (prueba habeas data)
        |  llama al motor de IA
        v
[Motor try-on: fal.ai FASHN]  -> imagen generada
        |
        v
   devuelve imagen (dataURI) -> se muestra en un modal sobre la PDP
```

## Cuándo usar esta skill

Cualquier petición de "probador virtual", "try-on", "que se vean con la prenda",
botón de foto/cámara en producto que genere una vista previa con IA, o montar
fal.ai / Cloudflare para moda. Funciona en cualquier CMS.

## Principio rector

**El widget nunca contiene claves de API.** Toda credencial vive en el Worker
(Cloudflare secrets). El widget solo conoce la URL pública del Worker y la URL de
la prenda. Así el embed se puede pegar en cualquier sitio sin exponer secretos.

---

## Paso 1 · Backend (Cloudflare Worker + fal.ai)

Es idéntico para todos los CMS. Se hace una sola vez.

1. **Cuentas:** crear cuenta en fal.ai y cargar **saldo** (tener tarjeta agregada
   **no** basta: fal cobra contra balance; sin saldo responde *"Exhausted balance"*).
   Crear cuenta en Cloudflare.
2. **Worker:** crear un Worker y pegar `references/worker.js`. Es el motor premium
   fal.ai FASHN (`fal-ai/fashn/tryon/v1.5`, ~$0.075/imagen, ~15-30 s).
3. **Base D1:** crear una base D1 y conectarla al Worker con el binding **`DB`**.
   El Worker **auto-crea las tablas** (`ensureSchema`) — no uses la consola D1 del
   panel para correr el `.sql` (suele fallar); el esquema está en `references/schema.sql`
   solo como documentación.
4. **Variables/secretos del Worker:**
   - `FAL_KEY` *(secret)* -> la clave de fal.ai.
   - `ALLOWED_ORIGINS` *(var)* -> dominios autorizados separados por coma, p. ej.
     `https://tutienda.com,https://www.tutienda.com`. El Worker hace CORS dinámico
     por `Origin`, así que un mismo Worker sirve a varios sitios.
5. **Verificar:** un `GET` al Worker debe responder `{"error":"Método no permitido"}`
   (405). Eso confirma que el código corre. La prueba real es un `POST` desde el
   origin permitido (ver `references/worker.js` para el shape del body).

Variables ajustables en el Worker: `RATE_LIMIT` (generaciones por IP por hora) y
`MAX_BYTES` (peso máximo de la foto).

### Motor alternativo gratis (cuando no hay tarjeta/saldo)
Existe un motor **gratis** con Hugging Face (Space `yisol/IDM-VTON`, token Read
`HF_TOKEN`). Es más lento (~30-90 s), con cuota diaria y puede hacer cola. Sirve
para demos; para producción usa fal.ai. La variante HF está en
`references/worker-hf-gratis.js`.

---

## Paso 2 · Widget (igual para todo CMS, solo cambia la inserción)

El widget de `references/widget.html` es **HTML + CSS + JS vanilla autocontenido**,
sin frameworks ni dependencias. Se configura con un objeto al inicio:

```js
const TRYON = {
  WORKER_URL: "https://TU-worker.workers.dev",  // tu Worker
  GARMENT_IMG: "",   // URL https de la prenda; si vacío, se lee de data-garment
  PRODUCT: ""        // nombre/handle del producto (para el registro)
};
```

Flujo: botón llamativo en la PDP -> modal con (1) subir/tomar foto, (2) **casilla de
consentimiento obligatoria** + casilla de marketing opcional, (3) loading, (4)
resultado a pantalla casi completa. Antes de enviar, el widget **redimensiona la
foto a JPEG <=1280px** en un `<canvas>` (arregla fotos HEIC/pesadas de iPhone y
acelera el envío).

### Reglas de oro del widget (aprendidas a la fuerza)
- **Normaliza la URL de la prenda a `https:` absoluta.** Muchos CMS (Shopify,
  WordPress) devuelven URLs **protocolo-relativas** `//cdn.../img.jpg` sin `https:`.
  fal las rechaza con *"Invalid image. Expecting a valid URL."* -> el Worker ya
  antepone `https:` si la URL empieza por `//`, y el widget debe hacer lo mismo al
  leer `data-garment`. **Esta es la causa #1 de "no se pudo generar".**
- La foto se envía como **dataURI** (no como URL).
- El botón debe ser grande y con el texto siempre visible (mín. ~76px de alto).

---

## Paso 3 · Inserción por CMS

El widget se inserta donde el CMS renderiza la página de producto, leyendo la
imagen principal de la prenda. Detalles en `references/insercion-por-cms.md`. Resumen:

| CMS | Cómo se inserta | Imagen de la prenda |
|-----|-----------------|---------------------|
| **Shopify** | snippet `am-tryon.liquid` renderizado en el template de producto con `{% render 'am-tryon' %}`; subir por Theme Access API (`themeFilesUpsert`) o editor de código del tema | `data-garment="https:{{ product.featured_image \| image_url: width: 1024 }}"` (¡el `https:` antepuesto!) |
| **WooCommerce / WordPress** | bloque HTML personalizado (Gutenberg `wp:html`) o widget HTML de Elementor en la plantilla de producto; o `do_shortcode` | `wp_get_attachment_image_url($product->get_image_id(),'large')` |
| **Webflow** | componente Embed (HTML) dentro del template de Product | URL del campo de imagen del Product (binding del CMS) |
| **Wix** | Embed HTML / iframe o Velo; en Velo leer el producto del Stores API | URL de la imagen del producto |
| **Squarespace** | Code Block en la plantilla de producto (requiere plan Business+) | URL de la imagen del producto |
| **Custom / headless** | pegar el embed directo en la plantilla | la URL de imagen que ya tenga el frontend |

Para sitios sin variable de producto en el punto de inserción, fijar `GARMENT_IMG`
manualmente por página, o poner el atributo `data-garment` en el contenedor.

---

## Paso 4 · Consentimiento y cumplimiento (no opcional)

La foto incluye **rostro = dato sensible/biométrico**. Obligatorio:

1. **Casilla de consentimiento previa, expresa e informada** antes de generar
   (bloquea el botón hasta marcarla). Marketing en **casilla separada y opcional**.
   Copys en `references/consent-copy.md`.
2. **Registro de consentimiento** guardado server-side (el Worker lo inserta en D1):
   fecha, IP, user-agent, producto, opt-in marketing, finalidad.
3. **Página de política de datos** publicada y enlazada desde el modal. Plantilla
   editorial en `references/politica-datos.html` (Ley 1581 Colombia; adaptar a
   GDPR/otra jurisdicción según el mercado).
4. **Retención** definida (recom. 12 meses) y borrado. **Solo mayores de 18.**
5. Recomendar **revisión legal** antes de producción y completar datos del
   responsable (razón social, NIT/registro, correo de datos).

---

## Errores frecuentes (checklist de diagnóstico)

- *"No se pudo generar" / 502* -> casi siempre la **URL de la prenda es
  protocolo-relativa** (`//cdn...`) o no es pública. Verifica que llegue `https://`.
- *"Exhausted balance"* -> fal sin **saldo** (no basta la tarjeta). Cargar créditos.
- *429 / "límite por hora"* -> `RATE_LIMIT` alcanzado (típico al probar varias veces
  desde la misma red). Subir el límite para demos o esperar el reset por hora.
- *CORS bloqueado* -> el `Origin` del sitio no está en `ALLOWED_ORIGINS`.
- *"Error interno" al subir foto* -> foto HEIC/muy pesada; el resize a JPEG <=1280px
  del widget lo resuelve (verifica que esté activo).
- *Consola D1 del panel falla* -> no la uses; deja que el Worker cree el esquema.

## Archivos de referencia

- `references/worker.js` — Worker fal.ai FASHN (motor premium, producción).
- `references/worker-hf-gratis.js` — variante gratis con Hugging Face IDM-VTON.
- `references/widget.html` — widget embebible configurable (vanilla, sin claves).
- `references/schema.sql` — esquema D1 (documentación; el Worker lo auto-crea).
- `references/consent-copy.md` — textos de consentimiento (obligatorio + marketing).
- `references/politica-datos.html` — plantilla de política de datos con estilo editorial.
- `references/insercion-por-cms.md` — pasos detallados de inserción por plataforma.
