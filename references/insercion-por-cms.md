# Inserción del widget por CMS

Regla común: el widget va **donde el CMS renderiza la página de producto**, y debe
recibir la **URL https absoluta** de la imagen principal de la prenda (vía
`TRYON.GARMENT_IMG` o el atributo `data-garment`). El Worker también normaliza
`//cdn...` -> `https://cdn...`, pero conviene mandarla ya correcta.

## Shopify
- Crear un **snippet** (p. ej. `snippets/am-tryon.liquid`) con el contenido del
  widget, y renderizarlo en el template de producto: `{% render 'am-tryon' %}`
  (en `sections/*product*.liquid` o `templates/product.*.liquid`).
- Imagen de la prenda — **antepón `https:`** porque Shopify la da protocolo-relativa:
  `data-garment="https:{{ product.featured_image | image_url: width: 1024 }}"`.
- Subida sin acceso al code editor: **Theme Access API** (app "Theme Access" ->
  password `shptka_...`) + mutation GraphQL `themeFilesUpsert` desde el navegador
  (origin `theme-kit-access.shopifyapps.com/cli`, headers `X-Shopify-Access-Token`
  + `X-Shopify-Shop`). Alternativa: Shopify CLI `theme push --only`.

## WooCommerce / WordPress
- Insertar el widget como **bloque HTML personalizado** (Gutenberg `<!-- wp:html -->`)
  o como **widget HTML de Elementor** dentro de la plantilla de Single Product, o vía
  un shortcode propio.
- El admin necesita capacidad `unfiltered_html` para conservar `<script>`/`<style>`.
- Imagen de la prenda en PHP:
  `wp_get_attachment_image_url( $product->get_image_id(), 'large' )`.
- Despliegue scriptable: **REST API** con Application Password, o fetch same-origin
  con cookie + `wpApiSettings.nonce` desde wp-admin.

## Webflow
- Añadir un componente **Embed** (HTML) dentro del template de la colección Product.
- Para la imagen, usar el **binding del campo de imagen** del Product en un atributo
  `data-garment` del contenedor.

## Wix
- **Embed HTML / iframe** (elemento "Insertar HTML") en la página de producto, o
  **Velo** para leer el producto del Stores API y pasar la URL de imagen.
- Nota: el iframe aísla estilos; si usas iframe, el widget va completo dentro de él.

## Squarespace
- **Code Block** en la plantilla de producto (requiere plan Business o superior para
  permitir código). Pasar la URL de imagen del producto a `data-garment`.

## Custom / headless (React, Next, etc.)
- Pegar el embed o portar el JS a un componente. Pasar la URL de imagen que ya tiene
  el frontend. Mantener la regla: **ninguna clave en el cliente**, solo `WORKER_URL`.

## Verificación (cualquier CMS)
1. El botón aparece en la PDP y abre el modal.
2. La casilla de consentimiento bloquea el botón hasta marcarla.
3. Subir una foto -> se ve "Foto lista ✓".
4. Generar -> en ~15-30 s (fal) aparece el resultado.
5. Si falla: revisar que `garmentImage` llegue como `https://...` (causa #1),
   `ALLOWED_ORIGINS` incluya el dominio, y fal tenga saldo.
