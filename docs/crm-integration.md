# Integración Directus → Twenty CRM (leads)

Cada lead que entra en la colección `leads` de Directus crea en Twenty una **Persona** (o reutiliza la existente), una **Oportunidad** y una **Nota** vinculada a ambas. Si Twenty falla, el lead **no se pierde**: queda en Directus con `crm_status = error` y un `crm_error` corto, y se reintenta con un botón.

Estado: **código y pruebas en el repo; nada aplicado en el servidor.** Falta: API key y campos en Twenty, red y variables en Directus, `--apply` del script (todo lo hace el orquestador, con confirmación).

## Diagrama

```
Web /api/lead ──(token lead-writer, solo create)──► Directus · leads (crm_status = pending)
                                                        │ evento items.create (asíncrono, no bloquea el formulario)
                                                        ▼
  Flow "Lead → Twenty" ── trigger ──► Flow "CRM · Sincronizar lead" ──────────────────────────────────┐
         │ (después)                    read_lead → guard (crm_status ≠ synced) → build (exec)        │
         ├─► recipients (exec)          → find_person  GET  /rest/people?filter=or(email,teléfono)    │
         └─► notify (notificación       → person_step (exec: reusar | crear)                          │
              interna al área)          → ensure_person GET /rest/people/{id} | POST /rest/people     │
                                        → opp_step (exec) → save_person (lead.twenty_person_id)       │
         mail_disabled (sin conectar)   → ensure_opp  GET /rest/opportunities/{id} | POST             │
                                        → opp (exec) → save_opp (lead.twenty_opportunity_id)          │
  Flow manual "Reintentar sync CRM"     → create_note POST /rest/notes (bodyV2.markdown)              │
    pick (leads seleccionados con       → targets (exec) → target_opp / target_person POST /rest/noteTargets
    crm_status = error, permisos del    → mark_synced (crm_status = synced, ids, crm_error = null)    │
    usuario) ── trigger (uno a uno) ───►                                                             │
                                        cualquier paso que falla ─► err_<paso> (trigger) ─────────────┘
                                                                         ▼
                                        Flow "CRM · Registrar error": sanitize (exec) → mark_error
                                        (crm_status = error, crm_error ≤ 500 car., sin datos personales)

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
- **Todo fallo termina en `crm_status = error`.** Cada paso tiene su propio `reject` → operación `trigger` hacia el Flow "CRM · Registrar error", que resume el error (paso + HTTP + detalle) y oculta correos, teléfonos, cadenas entre comillas y tokens. Máximo 500 caracteres.
- **Idempotencia en reintentos.** Los ids de Twenty se guardan en el lead en cuanto existen (`save_person`, `save_opp`). Un reintento busca la persona por email/teléfono (o usa `twenty_person_id`) y reutiliza `twenty_opportunity_id` con un `GET`; no duplica personas ni oportunidades. `guard` impide volver a sincronizar un lead `synced`.
- **El orden protege al aviso.** Primero se sincroniza (el núcleo nunca rechaza: su ruta de error termina bien) y después se notifica, así que el aviso interno sale también cuando Twenty falla.

Limitación conocida: si falla la vinculación de la nota (`target_*`), el reintento crea una nota nueva (la anterior queda sin vínculo en Twenty). No hay campo para guardar el id de la nota; es un caso raro y visible.

## Archivos

| Archivo | Rol |
| --- | --- |
| `scripts/crm-mapping.mjs` | Funciones puras lead → payloads Twenty (nombre partido, teléfono, nota markdown, saneado de errores) y configuración. |
| `scripts/directus-flows.mjs` | Define los 4 Flows y aplica el diff idempotente (dry-run por defecto). Reutiliza cliente, `applyPlan`, `formatPlan` y el simulador de `directus-schema.mjs`. |
| `scripts/directus-memory.mjs` | Simulador en memoria; ahora también Flows/operaciones con las restricciones FK y de unicidad de `resolve`/`reject`. |
| `tests/crm-mapping.test.mjs`, `tests/directus-flows.test.mjs` | Mapeo, plan idempotente y ejecución extremo a extremo contra un Twenty simulado (éxito, persona duplicada, 500, timeout, reintentos). |
| `tests/helpers/flow-runner.mjs` | Intérprete aproximado de Flows de Directus + Twenty simulado (solo tests). |

## Flows que crea el script

| Flow | Disparador | Notas |
| --- | --- | --- |
| **Lead → Twenty** | Evento `action`, `items.create`, colección `leads` | Asíncrono. Llama al núcleo y luego avisa al responsable del área. Incluye una operación **Correo** sin conectar. |
| **Reintentar sync CRM** | Manual en `leads` (ítem y listado), con confirmación | Lee los leads seleccionados **con `crm_status = error`** usando los permisos de quien pulsa (Tatiana solo ve los legales) y los pasa uno a uno al núcleo. |
| **CRM · Sincronizar lead** | Otro Flow | Núcleo descrito en el diagrama. Opera con `$full` y `emitEvents: false` (no dispara otros Flows). |
| **CRM · Registrar error** | Otro Flow | `sanitize` → `mark_error`. |

Los cuatro se crean **inactivos** salvo que se pase `--activate`. Se identifican por nombre; sus operaciones, por `key`. El script actualiza en su sitio lo que difiera (opciones, código, enlaces), avisa de operaciones ajenas y **nunca borra**. `accountability = $activity`: se registra la ejecución, no los datos de cada paso (evita guardar datos personales y cabeceras en los logs). Para depurar, cambiar temporalmente a "Track activity & logs" en la UI y volver a ejecutar el script después.

## Twenty: preparación (en la UI de Twenty, por el túnel privado)

1. **Verificar el esquema real** antes de activar: `GET http://twenty-server:3000/rest/open-api/core` (o Settings → APIs → documentación). Comprobar nombres de `name.firstName/lastName`, `emails.primaryEmail`, `phones.primaryPhoneNumber/primaryPhoneCountryCode/primaryPhoneCallingCode`, `stage`, `pointOfContactId`, `bodyV2.markdown`, `noteTargets.noteId/personId/opportunityId`.
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
| `DIRECTUS_NOTIFY_LEGAL_USER` / `DIRECTUS_NOTIFY_DATA_USER` (o `--notify-legal` / `--notify-data`) | — | UUID(s) de usuario Directus (Tatiana / Henry), separados por comas. Sin ninguno, el Flow no lleva aviso. Si falta uno, se avisa al otro. |

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

## Verificación manual

1. Flows creados: en Directus → Settings → Flows aparecen los 4; "CRM · Sincronizar lead" muestra una cadena lineal y debajo los `Error · <paso>`. Abrir una operación `exec` y comprobar que el código empieza por `// Generado por scripts/directus-flows.mjs`.
2. Lead de prueba (ambas áreas): crear un lead desde la web o en Directus con un email de prueba → en segundos `crm_status = synced`, `twenty_person_id` y `twenty_opportunity_id` rellenos. En Twenty: persona con nombre partido, email y teléfono; oportunidad "Web · Legal · …" en etapa NEW con Área/Origen/Idioma; nota con mensaje, página, UTM, GA4 client_id (si hubo consentimiento) e idioma, visible desde la persona y desde la oportunidad.
3. Persona duplicada: segundo lead con el mismo email → no aparece persona nueva; la oportunidad nueva apunta a la persona existente.
4. Fallo de CRM: parar el contenedor de Twenty (o poner una `TWENTY_API_KEY` inválida en una ventana controlada) → nuevo lead con `crm_status = error` y `crm_error` del tipo `find_person: HTTP 401 — …` sin correos/teléfonos. Restaurar → en el lead, botón **Reintentar sync CRM** → `synced`, sin duplicados.
5. Aviso: el usuario del área recibe la notificación interna (campana de Directus) también en el caso 4.
6. Permisos: con el usuario de Tatiana, el botón de reintento solo actúa sobre leads legales.
7. Borrar en Twenty los registros de prueba.

## Rollback

1. Desactivar los Flows "Lead → Twenty" y "Reintentar sync CRM" en la UI (o `PATCH /flows/{id} {"status":"inactive"}`). Los leads siguen llegando a Directus con `crm_status = pending`; nada se pierde. Al reactivar, sincronizar los pendientes poniéndolos en `error` y usando el botón de reintento.
2. Si la red causa problemas en el proxy: quitar `roma-crm-integration` del servicio Directus y redeploy (mantener la etiqueta `traefik.docker.network=coolify`).
3. Quitar `TWENTY_API_KEY` del entorno de Directus y revocar la key en Twenty.
4. Borrar los Flows es manual (el script nunca borra); si se vuelve a ejecutar el script, los recrea.

## Riesgos y puntos a verificar contra el Twenty/Directus reales

- **Esquema REST de Twenty v2.52** no verificado: formas de respuesta (`data.people[]`, `data.createPerson`, `data.person`), sintaxis de filtro `or(...)` con valores entre comillas, `bodyV2` solo con `markdown`, `primaryPhoneCallingCode`. El código extrae ids de forma tolerante, pero un 400 por nombre de campo se verá en `crm_error`.
- **Semántica de Directus 11.14** asumida y probada solo con un intérprete aproximado: plantillas `{{…}}` que devuelven el valor crudo cuando ocupan todo el campo (método/cuerpo/destinatarios), `item-read` con una sola clave devuelve un objeto, `$last` contiene el error en la rama `reject`, `$trigger.body.keys` en Flows manuales, `exec` disponible y con `module.exports = async function (data)`. Verificarlo con el paso 2 de la verificación.
- **Sin timeout en `request`**: si Twenty acepta la conexión y no responde, la ejecución puede quedarse colgada y el lead en `pending` (no perdido). Revisar `pending` antiguos y pasarlos a `error` para reintentar.
- **Deduplicación** solo por email exacto (minúsculas) o número nacional exacto; formatos distintos guardados a mano en Twenty pueden duplicar personas.
- **Partición de nombres** de tres palabras es ambigua ("Ana María Pérez" → Ana / María Pérez); el nombre completo siempre queda en la oportunidad y se corrige en Twenty.
- **Reintento concurrente** (evento y botón a la vez sobre el mismo lead) puede duplicar oportunidad: el botón solo actúa sobre `error`, lo que lo hace improbable.
- La API key de Twenty puede leer todas las personas del workspace (necesario para deduplicar): mantenerla solo en Directus y con caducidad.
