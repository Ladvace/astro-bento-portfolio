# Integración Directus → Twenty CRM (leads)

Cada lead que entra en la colección `leads` de Directus crea en Twenty una **Persona** (o reutiliza la existente), una **Oportunidad** y una **Nota** vinculada a ambas. Si Twenty falla, el lead **no se pierde**: queda en Directus con `crm_status = error` y un `crm_error` corto, y se reintenta con un botón. El **aviso interno** al responsable del área sale por un Flow propio, aunque Twenty falle o no responda, y un Flow programado impide que un lead quede atascado en `pending`.

Estado: **código y pruebas en el repo; nada aplicado en el servidor.** Falta: API key y campos en Twenty, red y variables en Directus, `--apply` del script (todo lo hace el orquestador, con confirmación).

## Diagrama

```
Web /api/lead ──(token lead-writer, solo create)──► Directus · leads (crm_status = pending)
                                                        │ evento items.create (asíncrono, no bloquea el formulario)
                         ┌──────────────────────────────┴──────────────────────────────┐
                         ▼ (independiente: no espera a Twenty)                         ▼
  Flow "Lead · Aviso interno"                              Flow "Lead → Twenty" ── trigger ──► Flow "CRM · Sincronizar lead"
    recipients (exec) → notify (notificación al área)        read_lead → guard (crm_status ≠ synced) → build (exec)
    [sin usuarios: no_recipients (log) + aviso CRÍTICO]      → find_person  GET /rest/people?filter=or(email,teléfono)
    mail_disabled (sin conectar)                             → person_step (exec: reusar | crear) → ensure_person GET | POST
                                                             → opp_step (exec: "[Verificar] " si la persona ya existía)
  Flow manual "Reintentar sync CRM"                          → save_person → ensure_opp GET | POST → opp → save_opp
    pick (seleccionados con crm_status ≠ synced,             → note_step (exec: reusar twenty_note_id | crear)
    permisos de quien pulsa) ── trigger uno a uno ──►        → ensure_note GET | POST → note → save_note (twenty_note_id)
                                                             → find_targets GET /rest/noteTargets?filter=noteId
  Flow programado "CRM · Pendientes atascados"               → targets (exec) → target_opp / target_person GET | POST
    cada 15 min: pending con date_created < ahora-15 min     → mark_synced (crm_status = synced, ids, crm_error = null)
    → crm_status = error, crm_error = stale_pending: …        cualquier paso que falla ─► err_<paso> (trigger)
                                                                        ▼
                                                 Flow "CRM · Registrar error": sanitize (exec) → mark_error
                                                 (crm_status = error, crm_error = "paso: HTTP estado CÓDIGO")

Directus ── red docker externa roma-crm-integration ──► twenty-server:3000 (Twenty, privado)
```

## Decisión de diseño: operaciones nativas (opción a), sin extensión

| Opción | Veredicto |
| --- | --- |
| Un único "Run Script" que haga todo | **No viable.** En Directus 11 la operación `exec` corre en `isolated-vm`: sin `fetch`, sin `require`, sin red ni módulos de Node. Solo sirve para lógica pura. |
| (a) Cadena de operaciones nativas | **Elegida.** `request` hace HTTP, `exec` hace la lógica (mapeo, decisiones, saneado), `item-update` guarda estado, `trigger` reutiliza sub-flows. |
| (b) Extensión hook/operation propia | Descartada por ahora: exige construir y montar la extensión en el contenedor de Coolify, mantenerla con cada actualización de Directus y redeploys con más riesgo (los 504 de hoy). Sigue siendo la salida si (a) no funcionara en el servidor real. |

Cómo se evita la fragilidad típica de los Flows encadenados:

- **La lógica condicional vive en `exec`, no en ramas.** Directus impone `resolve`/`reject` **únicos** por operación (no se pueden unir dos ramas en una misma operación). Por eso `person_step` y `opp_step` devuelven el **método y la ruta** de la siguiente petición: `GET /rest/people/{id}` si la persona ya existe, `POST /rest/people` si no. La cadena es lineal y siempre converge.
- **Las funciones de `exec` son las mismas que prueban los tests.** `scripts/crm-mapping.mjs` exporta funciones puras sin dependencias; el script incrusta su código fuente en cada operación `exec`. Un test las ejecuta en un contexto V8 vacío (sin `fetch`, `URL`, `require`) para garantizar que corren en el sandbox.
- **Todo fallo termina en `crm_status = error`.** Cada paso tiene su propio `reject` → operación `trigger` hacia el Flow "CRM · Registrar error".
- **`crm_error` sin texto libre (B1).** Solo guarda `paso: HTTP <estado> <CÓDIGO>` o `paso: error <CÓDIGO>`, p. ej. `ensure_opp: HTTP 500 InternalServerErrorException`, `find_person: error ECONNREFUSED`, `save_opp: HTTP 403 FORBIDDEN`, `opp: error TWENTY_NO_OPPORTUNITY_ID`. El código solo se acepta si tiene forma de identificador (`MAYÚSCULAS_CON_GUIONES` o `…Exception`/`…Error`); los mensajes de Twenty o Directus (que pueden repetir correos, nombres o teléfonos) **nunca** se guardan. Los errores propios de las funciones `exec` también son códigos (`LEAD_INVALID_AREA`, `TWENTY_NO_PERSON_ID`…).
- **Idempotencia en reintentos (B2).** Los ids de Twenty se guardan en el lead en cuanto existen (`save_person`, `save_opp`, `save_note` → `twenty_note_id`). Un reintento busca la persona por email/teléfono (o usa `twenty_person_id`), reutiliza `twenty_opportunity_id` y `twenty_note_id` con un `GET`, y consulta los vínculos ya existentes de la nota (`find_targets`) para crear solo los que falten. No duplica personas, oportunidades, notas ni vínculos. `guard` impide volver a sincronizar un lead `synced`. `twenty_note_id` es de solo lectura y **no** está en los permisos del lead-writer (la web no puede apuntar un lead a una nota ajena).
- **El aviso no depende de Twenty (M1).** "Lead · Aviso interno" es un Flow de evento propio sobre `items.create` de `leads`: Directus lo ejecuta en paralelo e independiente del Flow de sincronización, así que el aviso sale aunque Twenty falle, tarde o se cuelgue. Si no hay usuarios de aviso configurados, el Flow solo deja un `log` y el plan muestra `! CRÍTICO ‼ SIN AVISO INTERNO …`: **no active los Flows sin `--notify-legal`/`--notify-data`**.
- **Ningún lead queda atascado (M2).** Un `request` sin respuesta deja el lead en `pending`. El Flow programado "CRM · Pendientes atascados" (`*/15 * * * *`) pasa a `crm_status = error` (`crm_error = stale_pending: PENDING_TIMEOUT`) los leads `pending` con `date_created` anterior a `$NOW(-15 minutes)` (operación `item-update` con filtro, sin llamar a Twenty). Desde ahí, **Reintentar sync CRM** (que acepta cualquier `crm_status ≠ synced`) los sincroniza. Un lead aún `pending` de menos de 15 min puede estar en curso: no lo reintente a mano hasta que pase a `error`.
- **Suplantación (M5).** Cualquiera puede escribir el correo o teléfono de otra persona en el formulario. Si la búsqueda encuentra una Persona que **ya existía** (no creada para este lead: otro id que el guardado en `twenty_person_id`, o `createdAt` anterior a la llegada del lead; sin fecha se asume existente), la Oportunidad se crea como `[Verificar] Web · …` y la nota empieza con **«Contacto coincidió con persona existente: verificar identidad antes de compartir información.»** La Persona existente **nunca se sobrescribe**: solo se lee con `GET` (no hay ningún `PATCH`/`PUT` hacia Twenty; un test lo comprueba). Nombre, correo y teléfono del formulario quedan en Directus y en la oportunidad marcada.

Limitación conocida: si el vínculo de una nota con la persona falla y el reintento ocurre cuando la persona emparejada fue creada por otro lead **después** de la llegada de este, la marca `[Verificar]` de la **primera** oportunidad depende de que esta se haya creado antes del fallo (caso muy raro: lead atrasado + coincidencia + fallo entre `save_person` y `ensure_opp`).

## Archivos

| Archivo | Rol |
| --- | --- |
| `scripts/crm-mapping.mjs` | Funciones puras lead → payloads Twenty (nombre partido, teléfono, nota markdown, saneado de errores) y configuración. |
| `scripts/directus-flows.mjs` | Define los 6 Flows y aplica el diff idempotente (dry-run por defecto). Reutiliza cliente, `applyPlan`, `formatPlan` y el simulador de `directus-schema.mjs`. En `--apply`, pausa y reactiva (try/finally) los Flows activos que modifica. |
| `scripts/directus-memory.mjs` | Simulador en memoria; ahora también Flows/operaciones con las restricciones FK y de unicidad de `resolve`/`reject`. |
| `tests/crm-mapping.test.mjs`, `tests/directus-flows.test.mjs` | Mapeo, plan idempotente y ejecución extremo a extremo contra un Twenty simulado: éxito, persona existente → `[Verificar]` sin sobrescribir, 500/timeout/colgado, aviso con Twenty caído, `pending → error` por cron, reintento sin duplicar nota ni vínculos, `crm_error` sin texto libre, pausa/reactivación en un apply que falla. |
| `tests/helpers/flow-runner.mjs` | Intérprete aproximado de Flows de Directus + Twenty simulado (solo tests). |

## Flows que crea el script

| Flow | Disparador | Notas |
| --- | --- | --- |
| **Lead → Twenty** | Evento `action`, `items.create`, colección `leads` | Asíncrono. Solo llama al núcleo. |
| **Lead · Aviso interno** | Evento `action`, `items.create`, colección `leads` | Independiente del CRM: notificación interna (campana) al responsable del área; si falta uno, al otro. Sin usuarios configurados: solo `log` + aviso CRÍTICO en el plan. Incluye una operación **Correo** sin conectar (sin SMTP). |
| **Reintentar sync CRM** | Manual en `leads` (ítem y listado), con confirmación | Lee los leads seleccionados **con `crm_status ≠ synced`** (error o pendiente) usando los permisos de quien pulsa (Tatiana solo ve los legales) y los pasa uno a uno al núcleo. |
| **CRM · Pendientes atascados** | Programado, cron `*/15 * * * *` | `item-update` por filtro: `crm_status = pending` y `date_created < $NOW(-15 minutes)` → `crm_status = error`, `crm_error = stale_pending: PENDING_TIMEOUT`. No llama a Twenty. |
| **CRM · Sincronizar lead** | Otro Flow | Núcleo descrito en el diagrama. Opera con `$full` y `emitEvents: false` (no dispara otros Flows). |
| **CRM · Registrar error** | Otro Flow | `sanitize` → `mark_error`. |

Los seis se crean **inactivos** salvo que se pase `--activate`. Se identifican por nombre; sus operaciones, por `key`. El script actualiza en su sitio lo que difiera (opciones, código, enlaces), avisa de operaciones ajenas y **nunca borra**. `accountability = $activity`: se registra la ejecución, no los datos de cada paso (evita guardar datos personales y cabeceras en los logs). Para depurar, cambiar temporalmente a "Track activity & logs" en la UI y volver a ejecutar el script después.

## Twenty: preparación (en la UI de Twenty, por el túnel privado)

1. **Verificar el esquema real** antes de activar: `GET http://twenty-server:3000/rest/open-api/core` (o Settings → APIs → documentación). Comprobar nombres de `name.firstName/lastName`, `emails.primaryEmail`, `phones.primaryPhoneNumber/primaryPhoneCountryCode/primaryPhoneCallingCode`, `stage`, `pointOfContactId`, `bodyV2.markdown`, `noteTargets.noteId/targetPersonId/targetOpportunityId` (verificado en v2.52.0).
2. **Campos personalizados en Opportunity** (Settings → Data model → Opportunities):

   | Etiqueta | Nombre API | Tipo | Valores (API value) |
   | --- | --- | --- | --- |
   | Área | `area` | SELECT | `LEGAL` (Legal), `DATA` (Datos-IA) |
   | Origen | `source` | SELECT | `WEB` (Web), `WHATSAPP` (WhatsApp) |
   | Idioma | `locale` | TEXT | `es` / `en` |

   Twenty genera el *API value* de cada opción a partir de la etiqueta: revíselo y déjelo exactamente como en la tabla, o ajuste la configuración (abajo). La etapa inicial esperada es `NEW` (valor por defecto de Twenty).
3. **Rol mínimo para la API key** (Settings → Roles → nuevo rol "Integración web (Directus)"):
   - People: ver + editar (crear). Opportunities: ver + editar. Notes (incluye vínculos de nota): ver + editar.
   - Sin borrar/destruir, sin otros objetos, sin permisos de configuración del workspace.
   - "Ver People" es imprescindible para deduplicar por email/teléfono.
4. **API key** (Settings → APIs & Webhooks) asignada a ese rol, con caducidad. Se guarda solo en el entorno de Directus (`TWENTY_API_KEY`), nunca en el repo, en el Flow ni en el chat.

### Configuración si el esquema de Twenty difiere

Variables leídas **por el script** al generar los Flows (se incrustan en el código `exec`; no son secretos):

| Variable | Defecto | Uso |
| --- | --- | --- |
| `TWENTY_OPPORTUNITY_STAGE` | `NEW` | Etapa inicial. Vacía = no se envía. |
| `TWENTY_FIELD_AREA` / `TWENTY_FIELD_SOURCE` / `TWENTY_FIELD_LOCALE` | `area` / `source` / `locale` | Nombre API del campo. `-` = no enviar ese campo. |
| `TWENTY_AREA_VALUE_LEGAL` / `TWENTY_AREA_VALUE_DATA` | `LEGAL` / `DATA` | API value de las opciones de Área. |
| `TWENTY_SOURCE_VALUE` | `WEB` | API value de Origen. |
| `TWENTY_SEND_CALLING_CODE` | `true` | `false` si la versión no acepta `primaryPhoneCallingCode`. |
| `DIRECTUS_NOTIFY_LEGAL_USER` / `DIRECTUS_NOTIFY_DATA_USER` (o `--notify-legal` / `--notify-data`) | — | UUID(s) de usuario Directus (Tatiana / Henry), separados por comas. Sin ninguno, el Flow de aviso solo deja un log y el plan muestra **CRÍTICO ‼ SIN AVISO INTERNO**. Si falta uno, se avisa al otro. |

Cambiar cualquiera y volver a ejecutar el script actualiza las operaciones afectadas en su sitio.

## Directus: variables y red (servicio `nsc04koc0ck4s4c4ossoocok` en Coolify)

Variables de entorno **del contenedor Directus** (Coolify → servicio → Environment):

```env
TWENTY_BASE_URL=http://twenty-server:3000
TWENTY_API_KEY=<secreto, pegarlo solo en Coolify>
FLOWS_ENV_ALLOW_LIST=TWENTY_BASE_URL,TWENTY_API_KEY
# Cuando exista SMTP y se conecte la operación de correo:
# LEADS_NOTIFY_EMAIL=...   y añadirla a FLOWS_ENV_ALLOW_LIST
```

`{{$env.X}}` en un Flow solo ve las variables listadas en `FLOWS_ENV_ALLOW_LIST`; sin ella, la URL queda vacía y cada lead termina en `crm_status = error` (`find_person: error — …`), sin perderse. `IMPORT_IP_DENY_LIST` (por defecto `0.0.0.0,169.254.169.254`) bloquea solo las IP del propio contenedor y la de metadatos, no la de `twenty-server`: no hay que tocarla.

Cambio de compose — **solo** en el servicio `directus` (no en su Postgres/Redis). Conservar todo lo existente y añadir:

```yaml
services:
  directus:
    # ...configuración actual intacta...
    labels:
      # OBLIGATORIA: con dos redes, Traefik debe usar la de Coolify. Sin ella vuelven los 504 (ya pasó).
      - traefik.docker.network=coolify
    networks:
      # mantener las redes que ya tenga el servicio (la del stack de Coolify) y añadir:
      - roma-crm-integration

networks:
  roma-crm-integration:
    external: true
```

Tras el redeploy, comprobar en el servidor: `docker inspect <contenedor-directus> --format '{{json .NetworkSettings.Networks}}'` muestra la red del stack, `coolify` y `roma-crm-integration`; `https://cms.romahomestore.com/server/health` responde 200 (sin 504); desde el contenedor, `wget -qO- http://twenty-server:3000/healthz` (o equivalente) responde.

## Aplicar (orquestador, con confirmación)

```sh
# 1. Respaldo: directus schema snapshot + dump de la base (igual que directus-schema.mjs)
# 2. Plan contra producción (solo GET):
DIRECTUS_URL=https://cms.romahomestore.com DIRECTUS_ADMIN_TOKEN=… \
DIRECTUS_NOTIFY_LEGAL_USER=<uuid Tatiana> DIRECTUS_NOTIFY_DATA_USER=<uuid Henry> \
  node scripts/directus-flows.mjs
# 3. Crear inactivos:
  node scripts/directus-flows.mjs --apply --backup-done
# 4. Con Twenty, red y variables listos y verificados (abajo), activar:
  node scripts/directus-flows.mjs --apply --backup-done --activate
```

Simulación local sin red: `node scripts/directus-flows.mjs --fixture tests/fixtures/directus-state.json --apply` (la segunda corrida debe dar 0 cambios).

**Apply interrumpido (B3).** Si un Flow **activo** necesita cambios (operaciones nuevas, re-enlaces, código), el plan empieza por `flow-pause` (`status = inactive`) y termina con `flow-resume`. El script aplica todo lo demás dentro de un `try` y reactiva en el `finally`, también si un paso falla a mitad: nunca deja desactivado un Flow que estaba activo ni activa uno que no lo estaba (eso solo lo hace `--activate`). Los leads que lleguen durante esa ventana (segundos) quedan en `pending` y el Flow de pendientes atascados los pasa a `error` para reintentar. Si el apply falló, vuelva a ejecutarlo: converge.

Orden de aplicación: primero `scripts/directus-schema.mjs --apply` (crea el campo `leads.twenty_note_id`), después los Flows.

## Verificación manual

1. Flows creados: en Directus → Settings → Flows aparecen los 4; "CRM · Sincronizar lead" muestra una cadena lineal y debajo los `Error · <paso>`. Abrir una operación `exec` y comprobar que el código empieza por `// Generado por scripts/directus-flows.mjs`.
2. Lead de prueba (ambas áreas): crear un lead desde la web o en Directus con un email de prueba → en segundos `crm_status = synced`, `twenty_person_id` y `twenty_opportunity_id` rellenos. En Twenty: persona con nombre partido, email y teléfono; oportunidad "Web · Legal · …" en etapa NEW con Área/Origen/Idioma; nota con mensaje, página, UTM, GA4 client_id (si hubo consentimiento) e idioma, visible desde la persona y desde la oportunidad.
3. Persona duplicada: segundo lead con el mismo email → no aparece persona nueva; la oportunidad nueva apunta a la persona existente.
4. Fallo de CRM: parar el contenedor de Twenty (o poner una `TWENTY_API_KEY` inválida en una ventana controlada) → nuevo lead con `crm_status = error` y `crm_error` del tipo `find_person: HTTP 401 — …` sin correos/teléfonos. Restaurar → en el lead, botón **Reintentar sync CRM** → `synced`, sin duplicados.
5. Aviso: el usuario del área recibe la notificación interna (campana de Directus) también en el caso 4, y también si Twenty no responde (bloquear el puerto en una ventana controlada: el lead queda `pending`).
6. Pendientes atascados: con el caso anterior, a los ≤ 30 min el lead pasa a `crm_status = error` con `crm_error = stale_pending: PENDING_TIMEOUT`; el botón de reintento lo sincroniza.
7. Persona existente: lead de prueba con el correo de una persona ya existente en Twenty → oportunidad `[Verificar] Web · …`, nota con la línea de verificación y la persona **sin cambios** (nombre/teléfono originales).
8. Reintento tras fallo de nota: con `twenty_note_id` relleno, un reintento no crea otra nota (en Twenty, una sola nota por lead).
9. Permisos: con el usuario de Tatiana, el botón de reintento solo actúa sobre leads legales.
10. Borrar en Twenty los registros de prueba.

## Rollback

1. Desactivar los Flows "Lead → Twenty", "Reintentar sync CRM" y "CRM · Pendientes atascados" en la UI (o `PATCH /flows/{id} {"status":"inactive"}`). **Dejar activo "Lead · Aviso interno"**: no depende de Twenty. Los leads siguen llegando a Directus con `crm_status = pending`; nada se pierde. Al reactivar, el Flow programado los pasa a `error` y el botón de reintento (que acepta cualquier estado ≠ synced) los sincroniza.
2. Si la red causa problemas en el proxy: quitar `roma-crm-integration` del servicio Directus y redeploy (mantener la etiqueta `traefik.docker.network=coolify`).
3. Quitar `TWENTY_API_KEY` del entorno de Directus y revocar la key en Twenty.
4. Borrar los Flows es manual (el script nunca borra); si se vuelve a ejecutar el script, los recrea.

## Riesgos y puntos a verificar contra el Twenty/Directus reales

- **Esquema REST de Twenty v2.52** no verificado: formas de respuesta (`data.people[]`, `data.createPerson`, `data.person`), sintaxis de filtro `or(...)` con valores entre comillas, `bodyV2` solo con `markdown`, `primaryPhoneCallingCode`. El código extrae ids de forma tolerante, pero un 400 por nombre de campo se verá en `crm_error`.
- **Semántica de Directus 11.14** asumida y probada solo con un intérprete aproximado: plantillas `{{…}}` que devuelven el valor crudo cuando ocupan todo el campo (método/cuerpo/destinatarios), `item-read` con una sola clave devuelve un objeto, `$last` contiene el error en la rama `reject`, `$trigger.body.keys` en Flows manuales, `exec` disponible y con `module.exports = async function (data)`, `item-update` **sin clave y con `query.filter`** actualiza por consulta, `$NOW(-15 minutes)` se resuelve en ese filtro, y la forma del error de un `request`/`exec` fallido (`status`, `data.error`, `code`, `name`). Verificarlo con los pasos 2, 4 y 6 de la verificación.
- **Sin timeout en `request`**: si Twenty acepta la conexión y no responde, esa ejecución queda colgada; el aviso ya salió (Flow propio) y a los ≤ 30 min el lead pasa a `error` (Flow programado). Si después la ejecución colgada termina bien, marca `synced`; si se reintenta antes, podría duplicar la oportunidad (raro: el reintento solo debería usarse sobre `error`).
- **`createdAt` de Twenty**: la marca `[Verificar]` compara `createdAt` de la persona con `date_created` del lead (mismo servidor, mismo reloj). Si Twenty no devolviera `createdAt`, toda persona reutilizada se marca (conservador).
- **Deduplicación** solo por email exacto (minúsculas) o número nacional exacto; formatos distintos guardados a mano en Twenty pueden duplicar personas.
- **Partición de nombres** de tres palabras es ambigua ("Ana María Pérez" → Ana / María Pérez); el nombre completo siempre queda en la oportunidad y se corrige en Twenty.
- **Reintento concurrente** (evento y botón a la vez sobre el mismo lead) puede duplicar oportunidad. El botón acepta `pending` (para no dejar leads atascados si el cron estuviera desactivado): no lo use sobre leads `pending` de menos de 15 minutos.
- La API key de Twenty puede leer todas las personas del workspace (necesario para deduplicar): mantenerla solo en Directus y con caducidad.
