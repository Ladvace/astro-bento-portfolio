# Editar contenido web en Directus

## Estado y límites

Las cinco colecciones ya están creadas y cargadas en Directus con los registros aprobados ES/EN. Se verificaron lectura anónima, ocultación de borradores y una edición reversible con restauración del valor original. Los permisos de `projects` y los flujos existentes permanecen intactos. **El código de la rama `feature/cms-managed-content` todavía no está desplegado en producción.**

La migración es aditiva. El generador `scripts/website-schema.mjs` devuelve payloads y no ejecuta llamadas por sí mismo. Los registros usan los IDs y valores aprobados de `src/content/website-defaults.json`; no genere IDs nuevos. El respaldo anterior a la migración y el informe de verificación se guardaron de forma privada, fuera del repositorio.

Se edita contenido, no diseño: **código, layout, fuentes, CSS y rutas válidas permanecen protegidos**. Los campos son texto plano, enlaces o listas con formularios nativos; no existe un editor HTML ni un editor de código JSON en el administrador.

## Formularios e idiomas

Formularios creados en Directus:

| Módulo | Formulario del CMS | IDs existentes |
| --- | --- | --- |
| Identidad y enlaces | [website_globals](https://cms.romahomestore.com/admin/content/website_globals) | `global` (compartido, singleton) |
| Textos comunes | [website_common](https://cms.romahomestore.com/admin/content/website_common) | `es`, `en` |
| Inicio | [website_home](https://cms.romahomestore.com/admin/content/website_home) | `es`, `en` |
| Servicios | [website_practices](https://cms.romahomestore.com/admin/content/website_practices) | `es-legal`, `es-data`, `en-legal`, `en-data` |
| Personas | [website_people](https://cms.romahomestore.com/admin/content/website_people) | `es-tatiana`, `es-henry`, `en-tatiana`, `en-henry` |

`es` = español; `en` = inglés. Cada idioma se edita por separado: no hay traducción automática. ID, idioma (`locale`) y clave (`key`, donde exista) son metadatos de solo lectura. El nombre editorial identifica el registro dentro del CMS, no aparece en la web.

Editar directamente en estos formularios consume **0 tokens de IA**: no hace falta abrir un agente ni enviar el módulo completo al chat. Abra el registro correcto, cambie un campo y guarde. Las listas muestran campos por elemento (por ejemplo, empresa/cargo/año o nombre de herramienta), no JSON libre.

Para imágenes, conserve la ruta del recurso existente o suba el archivo a **Files** y pegue su URL pública en el campo de imagen; verifique antes que el archivo tenga acceso público aprobado. Para enlaces, pegue una URL o ruta válida como texto. No añada HTML, JavaScript, estilos ni rutas nuevas.

## CLI mínima: un campo cada vez

Desde la raíz del repositorio, con Node compatible con sus importaciones JSON:

```sh
node.exe scripts/content.mjs list
node.exe scripts/content.mjs list home
node.exe scripts/content.mjs get home es hero_title
```

`list` es local y no usa red. `get` solicita únicamente el campo indicado; puede leer anónimamente contenido publicado o usar el token privado si está disponible. Los alias son `globals`, `common`, `home`, `practices` y `people`; no se aceptan registros o campos arbitrarios.

Ejemplo con el texto aprobado actual (no propone copy nuevo). Primero inspeccione el parche exacto, **sin red ni token**:

```sh
node.exe scripts/content.mjs set home es hero_title 'Rigor jurídico.'
```

Salida esperada del dry-run:

```json
{
  "mode": "dry-run",
  "collection": "website_home",
  "id": "es",
  "patch": {
    "hero_title": "Rigor jurídico."
  }
}
```

Solo después de revisar el cambio y contar con autorización, con `DIRECTUS_CONTENT_TOKEN` ya inyectado de forma segura en el entorno local:

```sh
node.exe scripts/content.mjs set home es hero_title 'Rigor jurídico.' --apply
```

`--apply` exige ese token **privado**, nunca una variable `PUBLIC_*`. Envía un solo PATCH con el campo indicado: no lee ni reescribe el módulo completo y no reintenta mutaciones. No cambia el estado editorial. Un error de red puede dejar el resultado de la escritura incierto: consulte ese campo antes de decidir si repetir manualmente.

Los valores escalares son cadenas literales; solo los descriptores de lista interpretan el argumento como JSON y lo validan contra sus campos permitidos. La CLI no permite cambiar ID, idioma, clave, nombre editorial ni estado. Los mensajes de error no muestran el token ni cuerpos completos del servidor.

El CMS predeterminado es `https://cms.romahomestore.com`. `CONTENT_CMS_URL` permite un CMS de prueba: HTTPS o HTTP exclusivamente en `localhost`, `127.0.0.1` o `[::1]`, sin credenciales incrustadas, consulta ni fragmento. Las solicitudes rechazan redirecciones y abortan a los 10 segundos. Las pruebas unitarias inyectan respuestas sintéticas y no usan red real.

**Nunca copie credenciales ni tokens privados al chat, repositorio, comandos con valores de token o archivos de configuración versionados.** Use un entorno privado o un gestor de secretos y una cuenta con los mínimos permisos necesarios.

## Publicación estática: no instantánea

Guardar en Directus no cambia al instante la web pública. Mientras esta rama no esté desplegada y el flujo no incluya los módulos nuevos, esos cambios quedan únicamente en el CMS.

1. Revisar contenido por idioma, imágenes y enlaces; seleccionar **Publicado** en el formulario solo cuando corresponda. Los permisos nuevos permiten únicamente lectura de registros con `status = published`, sin conceder `create`, `update`, `delete` ni `share`.
2. Revisar y aprobar el mecanismo de publicación antes de ampliar el flujo existente a estas colecciones. No se ha alterado ese flujo en esta fase; una respuesta del webhook no basta para demostrar que el despliegue terminó.
3. Configurar **`WEBSITE_CONTENT_SOURCE=cms` en el entorno de compilación aprobado**, verificar las pruebas y compilar contra el CMS real. Sin esa opción, `snapshot` conserva la copia aprobada. El lector comparte las cinco peticiones entre páginas/idiomas y reintenta fallos transitorios de forma acotada; un fallo de transporte o de estructura de respuesta detiene la compilación, no publica una web vacía.
4. Ejecutar el despliegue autorizado y verificar el sitio servido. La publicación es **ESTÁTICA**, puede tardar **minutos**, no es instantánea ni una vista dinámica del CMS. Si falla la compilación, no afirmar que el contenido quedó publicado.

## Revisión y reversión

- Solicitud pequeña al agente: `home / es / hero_title → «texto aprobado»; sólo español; no cambiar diseño; mostrar dry-run antes de aplicar`. No hace falta adjuntar el repositorio ni toda la página.
- Antes de editar, leer el valor actual con `get` o desde el formulario. Para revertir un texto, restituir ese valor en el campo y volver a compilar; no restaurar todo el esquema o los permisos por un cambio de copy.
- Los valores ausentes o inválidos y los registros no publicados no sustituyen la copia de respaldo aprobada. **Borrador no equivale a eliminar una sección existente**. Para ocultar una nota opcional use una cadena vacía; para una lista opcional use una lista vacía. No elimine los registros base.
- Una emergencia puede compilarse con `WEBSITE_CONTENT_SOURCE=snapshot` para volver al contenido inicial aprobado. Eso no borra el CMS ni altera los artículos existentes; es una decisión de publicación separada.
- Rutas, estructura, CSS, fuentes, componentes e integraciones requieren código/revisión; los campos del CMS no son un constructor de páginas.

## Validación realizada

- Pruebas automatizadas: **77 aprobadas, 0 fallos**.
- Astro: **0 errores, 0 advertencias**; quedan cuatro sugerencias informativas del layout heredado `BasicLayout.astro`.
- Compilación realizada con `WEBSITE_CONTENT_SOURCE=cms` contra el CMS real; la vista local de revisión usa `PUBLIC_NOINDEX=true`.
- Navegador: **485 comprobaciones aprobadas** en 36 páginas, a 320, 390, 768, 1024, 1280 y 1920 px.
- Contenido y estructura de las 36 páginas comparados con la web publicada, sin diferencias. Capturas de inicio ES en móvil/escritorio, archivo EN y artículo móvil inspeccionadas visualmente.
- Evidencias locales: `qa-output/browser-results.json`, `qa-output/live-parity.json`, `qa-output/css-parity.json` y `qa-output/screenshots/`. Son artefactos locales excluidos de Git, no archivos para publicar.

Estas pruebas no equivalen a un despliegue de producción: la activación y el flujo de publicación siguen siendo un paso separado.

SEO/Meta y OpenCode quedan como integraciones futuras: **no se han instalado** en este trabajo. Esto no elimina ni modifica las etiquetas o textos SEO ya existentes.

## Panel de la landing y bandeja de leads

Esta sección describe el esquema que añade `scripts/directus-schema.mjs` (rama `feat/directus-schema`). **Aún no se ha aplicado en producción.**

### Quién edita qué

| Persona | Rol/política Directus | Puede |
| --- | --- | --- |
| Henry | Administrator (sin cambios) | Todo: textos compartidos, área de datos, pasos, GA4, permisos y Flows. |
| Tatiana | `editor-legal` (app access, sin admin) | Leer todas las colecciones `website_*`; editar `website_practices` con `key = legal`, su perfil `website_people` con `key = tatiana` (foto, credencial, LinkedIn), `legal_whatsapp` en `website_globals`, `hero_legal_cta` y `form_area_legal_option` en `website_home`; crear/editar/borrar FAQ y testimonios **solo con `area = legal`**; ver leads con `area = legal` y cambiar únicamente su `status`. Puede subir archivos (Files) y editar solo los suyos. |
| Endpoint web `/api/lead` | `website-lead-writer` (sin app access) | Solo `create` en `leads`, con los campos `name, area, message, contact_whatsapp, contact_email, locale, consent, consent_text, page, utm_source, utm_medium, utm_campaign, ga_client_id`. Validación: `consent = true` y `area ∈ {legal, data}`. Sin lectura: Directus responde `204` al crear. |
| Público | Política pública existente | Solo lectura de `website_*` con `status = published` y la lista explícita de campos que lee la compilación. **Nunca `leads`.** |

El usuario de Tatiana se asigna al rol `editor-legal` a mano. El token estático de `website-lead-writer` lo crea el orquestador y se guarda como `DIRECTUS_LEADS_TOKEN` en Coolify (variable de servidor, nunca `PUBLIC_*`).

### Campos y colecciones nuevas

- `website_globals`: `legal_whatsapp`, `data_whatsapp` (E.164, p. ej. `+573001234567`; vacío oculta el botón), `contact_email`, `ga4_id` (vacío desactiva GA4).
- `website_common` (por idioma): `privacy_title`, `privacy_policy` (Markdown; la web lo sanea al renderizar).
- `website_home`: `hero_legal_cta`, `hero_data_cta`, `steps_title`, `faq_title`, `testimonials_title`, `form_*` (título, etiquetas, opciones de área, ayuda, botón y error), `thanks_*`, `consent_label`, `consent_privacy_link_label`, `consent_banner_text`, `consent_banner_accept_label`, `consent_banner_reject_label`. El hero orientado a problema reutiliza `hero_title`, `hero_accent` y `hero_description`.
- `website_practices`: `problems` (lista), `audience`, `whatsapp_message` (texto prellenado de WhatsApp).
- `website_people`: `photo` (archivo de Files), `credential`. `linkedin_url` ya existía.
- `website_faq` (`area`: legal|data|general, `question`, `answer`), `website_steps` (`title`, `description`), `website_testimonials` (`area`: legal|data, `quote`, `author`, `role`). Todas con `id` UUID automático, `locale`, `status` y `sort` (arrastrar para ordenar). Los registros publicados de un idioma **sustituyen** a la copia de respaldo de ese idioma; si no hay ninguno publicado se usa la copia del repositorio. Los testimonios no tienen copia de respaldo: la sección se oculta mientras no haya testimonios publicados.
- `leads` (privada): `name, area, message, contact_whatsapp, contact_email, locale, consent, consent_text, page, utm_*, ga_client_id, status` (nuevo|contactado|descartado, por defecto `nuevo`), `crm_status` (pending|synced|error, por defecto `pending`), `twenty_person_id`, `twenty_opportunity_id`, `crm_error`, `date_created`. Archivar = `status = descartado`.

Todos los campos nuevos son opcionales: las filas existentes quedan en `NULL` y la web usa la copia de respaldo hasta que se rellenen (o se ejecute `--seed`).

El Flow **Trigger Coolify Build** pasa a incluir `website_faq`, `website_steps` y `website_testimonials`. `leads` nunca dispara compilaciones.

### Cómo correr el script

Sin red, contra el estado de referencia del repositorio (antes de la migración):

```sh
node scripts/directus-schema.mjs --fixture tests/fixtures/directus-state.json            # plan
node scripts/directus-schema.mjs --fixture tests/fixtures/directus-state.json --apply    # simula y muestra la segunda corrida (debe ser 0)
```

Contra un Directus real, **dry-run por defecto** (solo GET):

```sh
export DIRECTUS_URL=https://cms.romahomestore.com
export DIRECTUS_ADMIN_TOKEN=…            # desde el gestor de secretos; nunca en argumentos ni en el repo
node scripts/directus-schema.mjs [--seed] [--json]
```

Aplicar (solo con confirmación explícita y tras `directus schema snapshot` + dump de la base):

```sh
node scripts/directus-schema.mjs --apply --backup-done [--seed]
```

- Idempotente: compara con el estado actual y crea solo lo que falta. Al terminar vuelve a planificar e imprime `Segunda corrida: 0 cambio(s)`.
- Nunca borra ni estrecha: las listas de campos de permisos existentes se amplían por unión; filtros o validaciones distintos de lo esperado, un Flow ausente o permisos públicos sobre `leads` se informan como avisos `!` para revisión manual.
- Políticas y roles se buscan por nombre (`website-lead-writer`, `editor-legal`); la política pública por `$t:public_label` o `DIRECTUS_PUBLIC_POLICY_ID`.
- `--seed` crea los registros que falten de `website-defaults.json` y rellena solo campos `NULL`. Cada escritura en colecciones ya vinculadas al Flow dispara una compilación: ejecútelo en una ventana tranquila.
- **Orden de despliegue:** aplicar el script **antes** de desplegar el código que lee los campos nuevos. Si la compilación pide un campo que la política pública no puede leer, Directus responde 403 y la compilación falla (no publica una web vacía).
- La colección `experience` no se toca. Solo aparece tipada en `src/lib/directus.ts`; ningún componente la consulta.
