# Analítica: solo Google Analytics 4

Medición única: GA4 (`gtag.js`). ID en `website_globals.ga4_id` (vacío lo desactiva). Componente: `src/components/roma/Analytics.astro`.

Se carga solo en producción, fuera de previews `PUBLIC_NOINDEX`, y con un ID válido (`G-XXXXXXXX`).

## Consentimiento (Consent Mode v2)

- Antes de cargar `gtag.js` se declara `consent default`: `ad_storage`, `ad_user_data`, `ad_personalization` y `analytics_storage` en `denied` (`wait_for_update: 500`). Con esto GA4 recibe pings sin cookies (datos modelados) aunque no haya aceptación.
- El banner de cookies (`ConsentBanner`) emite `roma:consent` (`granted`/`denied`, también al cargar si ya había elección). `granted` hace `consent update` con `analytics_storage: granted`; `denied` lo devuelve a `denied`. Las señales de publicidad **siempre** quedan denegadas (Google Signals y personalización desactivados).
- Idempotente: repetir el evento no repite el `update`.

## Eventos

| Evento | Cuándo | Parámetros |
|---|---|---|
| `page_view` | automático al cargar | (estándar) |
| `cta_click` | clic en CTA (`data-track="cta_click"`) | `area` (legal/data/none), `location` (hero, services, ...) |
| `contact` | clic en WhatsApp o correo | `method` (`whatsapp`/`email`), `area`, `location` |
| `lang_switch` | cambio ES/EN | `language_from`, `language_to` |
| `form_start` | primer input del formulario | `area`, `location` |
| `form_submit_attempt` | envío del formulario (antes de validar en servidor) | `area`, `location` |
| `generate_lead` | carga de `/{es,en}/gracias/` tras enviar el formulario | `area`, `method: form` |

`generate_lead` se envía una sola vez por formulario enviado: el envío deja una marca en `sessionStorage` (caduca en 10 min) que la página de gracias consume. Recargar o entrar directo a `/gracias/` no cuenta. Ningún parámetro contiene nombre, correo, teléfono ni mensaje; la URL de gracias solo lleva `?area=`.

## Vinculación del lead

Si hay consentimiento, el formulario rellena el campo oculto `ga_client_id` (client_id de GA4, `[A-Za-z0-9.]{1,64}`). Se guarda en `leads.ga_client_id` (Directus) y aparece en la nota de Twenty, para cruzar un lead con su sesión en GA4. Sin consentimiento queda vacío.

## Configuración en GA4 (pasos manuales)

1. Admin > Eventos: marcar como **evento clave** `generate_lead` y `contact` (los eventos aparecen tras recibir el primero; o crearlos con "Crear evento clave" por nombre).
2. Admin > Definiciones personalizadas > Crear dimensión (alcance **Evento**): `area`, `location`, `method`. Opcional: `language_from`, `language_to`.
3. Admin > Flujos de datos > Medición mejorada: dejar activa; los eventos propios no dependen de ella.
4. Admin > Retención de datos: 14 meses (recomendado). Google Signals: desactivado.
5. Admin > Vinculaciones de productos > Search Console: Vincular, elegir la propiedad `portfolio.romahomestore.com` (debes ser propietario en Search Console) y asociarla al flujo web. Los informes aparecen en Informes > Search Console (requiere la colección habilitada en la biblioteca).
6. Verificar con Admin > DebugView y en Informes > Tiempo real.

## Comprobaciones

`npm test` incluye un test estructural de `Analytics.astro` (consent default antes de config, ads denegados, sin PII).
