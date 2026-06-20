<h1 align="center">🪞 Probador Virtual con IA · Virtual Try-On</h1>

<p align="center">
  Tu clienta sube una foto y ve, con IA, cómo le queda la prenda — directamente en tu página de producto.<br>
  Embebible en <b>cualquier CMS</b> de e-commerce, sin exponer claves.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat">
  <img src="https://img.shields.io/badge/CMS-Shopify%20%7C%20WooCommerce%20%7C%20Webflow%20%7C%20Wix-blue?style=flat">
  <img src="https://img.shields.io/badge/backend-Cloudflare%20Workers-F38020?style=flat&logo=cloudflare&logoColor=white">
  <img src="https://img.shields.io/badge/IA-fal.ai%20%2F%20FASHN%20%C2%B7%20IDM--VTON-412991?style=flat">
  <img src="https://img.shields.io/badge/privacidad-Ley%201581%20%2F%20GDPR-success?style=flat">
</p>

> [!TIP]
> **¿Vendes ropa online?** El try-on virtual reduce devoluciones y sube la conversión: la clienta compra con más seguridad porque *se ve* con la prenda antes de pagar.

---

## 🧠 Cómo funciona

```
Clienta (foto + consentimiento)
        │
        ▼
  Widget (widget.html)  ──►  Cloudflare Worker  ──►  Motor de IA (try-on)
        ▲                         │                        │
        └────────  imagen generada de la clienta con la prenda  ◄───┘
```

1. La clienta sube o toma una foto y **autoriza** el uso de sus datos (habeas data · Ley 1581 Colombia / GDPR).
2. El **widget** (`references/widget.html`) envía la foto + la URL de la prenda a un **Cloudflare Worker**.
3. El Worker llama al motor de try-on y devuelve la imagen generada. **Las claves viven como *secrets* del Worker — nunca en el navegador.**

---

## ⚙️ Motores soportados

| Motor | Velocidad | Costo | Variable | Archivo |
|-------|-----------|-------|----------|---------|
| **fal.ai / FASHN** | ⚡ Rápido | 💲 De pago | `FAL_KEY` | `references/worker.js` |
| **Hugging Face / IDM-VTON** | 🐢 Más lento | 🆓 Gratis | `HF_TOKEN` | `references/worker-hf-gratis.js` |

> Las claves se configuran como *secrets* en Cloudflare. **No hay credenciales en este repositorio.**

---

## 🚀 Instalación rápida

```bash
# 1. Clona el repo
git clone https://github.com/cmalejandrojimenez/probador-virtual-ia.git

# 2. Despliega el Worker en Cloudflare y añade tu secret
wrangler secret put FAL_KEY        # o HF_TOKEN para la versión gratis
wrangler deploy

# 3. Configura la URL del Worker dentro de references/widget.html
# 4. Pega el widget en tu CMS (ver references/insercion-por-cms.md)
```

📖 Guía completa de instalación y decisiones en **[`SKILL.md`](SKILL.md)**.

---

## 📂 Contenido del repositorio

| Archivo | Qué es |
|---------|--------|
| `SKILL.md` | Guía completa de instalación y decisiones |
| `references/widget.html` | Widget embebible configurable |
| `references/worker.js` | Cloudflare Worker (fal.ai / FASHN) |
| `references/worker-hf-gratis.js` | Cloudflare Worker (Hugging Face, gratis) |
| `references/schema.sql` | Esquema para registrar consentimientos |
| `references/consent-copy.md` | Textos de consentimiento |
| `references/politica-datos.html` | Plantilla de política de datos |
| `references/insercion-por-cms.md` | Pasos de inserción por CMS |

---

## 🔐 Privacidad y cumplimiento

Procesar fotos de personas implica tratar **datos personales sensibles**. Este proyecto incluye copy de consentimiento y una plantilla de política de tratamiento de datos. **Configura siempre la base legal antes de procesar fotos de personas** (Ley 1581 de 2012 en Colombia · GDPR en Europa).

---

## 🗺️ Roadmap

- [ ] Demo pública en vivo
- [ ] Soporte para más prendas por foto
- [ ] Panel de métricas (conversión y devoluciones)
- [ ] Plugin nativo de Shopify

---

## 📄 Licencia

[MIT](LICENSE) — úsalo y adáptalo libremente.

<sub>Hecho con foco en ventas reales por <a href="https://github.com/cmalejandrojimenez">@cmalejandrojimenez</a>. Si te sirve, deja una ⭐.</sub>
