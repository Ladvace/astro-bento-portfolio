# Analítica: solo Google Analytics 4

Medición única: GA4 (`gtag.js`). ID en `website_globals.ga4_id` (vacío lo desactiva). Componente: `src/components/roma/Analytics.astro`.

Se carga solo en producción, fuera de previews `PUBLIC_NOINDEX`, y con un ID válido (`G-XXXXXXXX`).

## Consentimiento (Consent Mode v2, modo básico)

- **Sin consentimiento no hay datos en GA4.** El HTML no contiene `gtag.js` ni ninguna petición a Google; no se escribe ninguna cookie. Visitantes que no han elegido o que rechazan no aparecen en GA4 (ni como datos modelados). Esto coincide con lo que promete el banner y con la Ley 1581 de 2012 (consentimiento previo).
- El tráfico orgánico se mide sin cookies con **Search Console** (impresiones, clics, consultas, páginas), vinculado a GA4 (ver abajo); es la fuente para lo que GA4 no ve.
- El banner (`ConsentBanner`) emite `roma:consent` (`granted`/`denied`, también al cargar si ya había elección guardada en `localStorage.roma_consent`).
- `granted`: se declara `consent default` (`ad_storage`, `ad_user_data`, `ad_personalization` = `denied`; `analytics_storage` = `granted`), se inyecta `gtag.js` dinámicamente y se hace `config` (envía `page_view`). Google Signals y personalización desactivados: la publicidad **siempre** queda denegada.
- `denied` (o revocación posterior): si `gtag.js` aún no se cargó, no se carga nada. Si ya estaba cargado: `consent update analytics_storage: denied`, flag `ga-disable-<ID>` y borrado de cookies `_ga*` del dominio.
- Revocar: el enlace del pie (`home.consent_preferences_label`) dispara `roma:consent-open`; el banner reaparece y la nueva elección emite `roma:consent`. Si no existe esa etiqueta en el contenido, el enlace no se renderiza.
- Idempotente: repetir el evento no repite el `update`. Los eventos anteriores a la concesión se descartan (no hay cola).

## Eventos

| Evento | Cuándo | Parámetros |
|---|---|---|
| `page_view` | automático al cargar | (estándar) |
| `cta_click` | clic en CTA (`data-track="cta_click"`) | `area` (legal/data/none), `location` (hero, services, ...) |
| `contact` | clic en WhatsApp o correo | `method` (`whatsapp`/`email`), `area`, `location` |
| `lang_switch` | cambio ES/EN | `language_from`, `language_to` |
| `lead_form_start` | primer input del formulario | `area`, `location` |
| `lead_form_submit` | envío del formulario (antes de validar en servidor) | `area`, `location` |
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

`npm test` incluye tests estructurales de `Analytics.astro` y `ConsentBanner.astro` (sin gtag estático, ads denegados, sin PII). Los nombres `lead_form_*` evitan chocar con `form_start`/`form_submit` de Medición mejorada.
