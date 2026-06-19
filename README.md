# Probador Virtual con IA (Virtual Try-On)

Widget embebible + backend *serverless* para que una clienta suba una foto y vea, mediante IA, cómo le queda una prenda de la página de producto. Funciona en cualquier CMS de ecommerce (Shopify, WooCommerce/WordPress, Webflow, Wix, Squarespace o sitio custom) sin exponer claves.

## Cómo funciona

1. La clienta sube/toma una foto y **autoriza** el uso de sus datos (habeas data · Ley 1581 Colombia / GDPR).
2. El **widget** (`references/widget.html`) envía la foto + la URL de la prenda a un **Cloudflare Worker**.
3. El Worker llama al motor de try-on y devuelve la imagen generada. Las claves viven como *secrets* del Worker, nunca en el navegador.

## Motores soportados

- **fal.ai / FASHN** (`references/worker.js`) — rápido y de pago. Variable `FAL_KEY`.
- **Hugging Face / IDM-VTON** (`references/worker-hf-gratis.js`) — gratuito, más lento. Variable `HF_TOKEN`.

> Las claves (`FAL_KEY`, `HF_TOKEN`) se configuran como *secrets* en Cloudflare. **No hay credenciales en este repositorio.**

## Contenido

| Archivo | Qué es |
|---|---|
| `SKILL.md` | Guía completa de instalación y decisiones |
| `references/widget.html` | Widget embebible configurable |
| `references/worker.js` | Cloudflare Worker (fal.ai/FASHN) |
| `references/worker-hf-gratis.js` | Cloudflare Worker (Hugging Face, gratis) |
| `references/schema.sql` | Esquema para registrar consentimientos |
| `references/consent-copy.md` | Textos de consentimiento |
| `references/politica-datos.html` | Plantilla de política de datos |
| `references/insercion-por-cms.md` | Pasos de inserción por CMS |

## Privacidad

Incluye copy de consentimiento y plantilla de política de tratamiento de datos personales. Configura siempre la base legal antes de procesar fotos de personas.

---
MIT — úsalo y adáptalo libremente.
