# Copy v1: racional y pendientes

Archivo de datos: `content/copy-v1.json`. Está agrupado por colección de Directus (`website_home`, `website_practices`, `website_people`, `website_common`, `website_faq`, `website_steps`, `website_globals`), cada una con `es` y `en`. `website_globals` tiene además `shared` para los datos que no dependen del idioma.

## Racional por bloque

**Hero.** El titular tiene dos líneas paralelas, una por público: «Tu asunto legal, en orden. / Tu negocio, guiado por datos.» Cada visitante encuentra su problema en la primera lectura sin mezclar las áreas. «Rigor jurídico. Precisión analítica.» pasa a `hero_eyebrow` como línea de marca. Hay dos CTAs, cada uno con un `hint` que dice quién responde y dónde se presta el servicio («Solo Colombia» / «Latinoamérica»). Así se filtra a quien escribe desde fuera de Colombia antes de que contacte el área legal.

**Prácticas.**
- Legal: está redactada desde la situación de la persona («Falleció un familiar…», «Vas a comprar…») y no desde la rama del derecho. No hay superlativos, promesas ni palabras como «ganar» o «garantizado», en línea con la Ley 1123 de 2007, que exige una publicidad profesional sobria y prohíbe ofrecer resultados. La audiencia incluye a los colombianos que viven en el exterior, que es un segmento relevante en sucesiones e inmuebles.
- Datos: el marketing digital es explícito (GA4, Google Ads, Meta Ads, tableros, automatización, IA aplicada). Los problemas están escritos con el lenguaje del dueño de una PYME.
- Mensajes de WhatsApp: son cortos, identifican la fuente («Vi la web de ROMA») y no piden datos sensibles.

**Casos.** Hay resúmenes orientados a valor para los 4 artículos del blog. Ninguno los presenta como clientes y no se citan cifras.

**Cómo trabajamos.** Son 3 pasos que bajan el riesgo percibido: escribir, conversación honesta (decimos que no si no aplica) y propuesta con honorarios por escrito antes de empezar.

**FAQ.** Responden las 6 objeciones típicas. El costo y los tiempos quedan en [PENDIENTE] para no afirmar nada sin dato. La confidencialidad se apoya en el secreto profesional y en la Ley 1581.

**Formulario.** Tiene etiquetas, placeholders con ejemplos según el área (`form_message_placeholder_legal` / `_data`), ayudas, errores en tono amable y una salida a WhatsApp en los errores de servidor. El consentimiento sigue la Ley 1581 de 2012, con `{privacy_link}` sustituido por `form_consent_link_label`. `{max}` lo pone el endpoint.

**Gracias.** El texto cambia según `?area=`, recuerda no enviar documentos y ofrece WhatsApp para lo urgente.

**Cookies.** Usa un modelo opt-in coherente con PostHog en `persistence: 'memory'` hasta que el visitante acepte.

**Privacidad.** Es una política base conforme a la Ley 1581 de 2012 y al Decreto 1377 de 2013 (Decreto 1074 de 2015). Incluye el responsable, los datos que se recogen, las finalidades, los encargados y transferencias, los derechos (conocer, actualizar, rectificar, suprimir, revocar y presentar quejas ante la SIC) y los plazos legales: 10 días hábiles para consultas, 15 días hábiles para reclamos y 5 días para subsanar. Está en Markdown dentro de `privacy_body`. **Debe revisarla Tatiana antes de publicarla.**

**SEO.** Los títulos ya incluyen «| ROMA» porque `Home.astro` usa `seo_title` tal cual. Si las páginas de servicio llegan a anteponer `seo_suffix`, hay que quitar «| ROMA».

**Bios.** Las credenciales están en un campo propio (`credential`). En Henry solo aparece lo que ya existe en el sitio: los cargos del CMS (Fountain Forward, Conduent, Teleperformance) e «Ingeniero industrial (UIS)», que él mismo menciona en su artículo de vibe coding. En Tatiana todo queda en [PENDIENTE].

## Claves nuevas (no existen en `website-defaults.json`)

- `website_home`: `hero_eyebrow`, `hero_legal_label/hint`, `hero_data_label/hint`, `services_description`, `steps_label/title`, `publications_description`, `faq_label/title`, `email_contact_label`, `cases[]`.
- `website_practices`: `cta_label`, `whatsapp_label`, `whatsapp_message`, `seo_title`, `seo_description`, `problems_title`, `problems[]`, `audience_title`, `audience`, `form_title`.
- `website_people`: `credential`, `contact_label`, `photo_alt`.
- `website_common`: `footer_privacy_label`, `blog_seo_*`, `whatsapp_float_*`, `form_*`, `thanks_*`, `cookie_*`, `privacy_*`, `lead_area_*`.
- Colecciones nuevas: `website_faq` (sort, area, question, answer) y `website_steps` (sort, title, description).
- Claves que ya no se usan: `rail_*`, `signature_*`, `original_note`, `hero_primary_label`, `hero_secondary_label` y `article_original_note`, según la Fase 4. `archive_note` (ES) se reduce a «Algunos casos están publicados en inglés.» y en EN queda vacío.

## Otros cambios

- El nombre pasa a escribirse «Tatiana Rodríguez», con tilde. El CMS actual dice «Rodriguez». Hay que confirmar la grafía correcta.

## Verificación de longitudes

Las longitudes se revisaron con un script: 80 campos comprobados y 0 infracciones. Todos los `seo_title` tienen 60 caracteres o menos (el más largo, 58) y todos los `seo_description` tienen 155 o menos (el más largo, 143). Los mensajes de WhatsApp tienen 140 o menos. Las claves de ES y EN coinciden en todas las colecciones.

## [PENDIENTE] para el usuario (45 apariciones en total en ES y EN)

1. WhatsApp de Tatiana y de Henry (`website_globals.shared`).
2. Correo de contacto visible y correo de habeas data.
3. Responsable del tratamiento: nombre o razón social, NIT o cédula, dirección y teléfono. También la fecha de vigencia de la política.
4. Lista de proveedores tecnológicos y países donde guardan datos (Directus/OVH, PostHog EU, GA4, Twenty).
5. Costo y duración de la primera conversación (FAQ 1).
6. Tiempo de respuesta a mensajes (FAQ 3 y página de gracias).
7. Ciudad o ciudades para atención presencial jurídica (FAQ 6).
8. Tatiana: universidad, número de tarjeta profesional, años de ejercicio y URL de LinkedIn.
9. Henry: años de experiencia. Confirmar también que se puede citar «Analytics Director en Fountain Forward» y «UIS».
10. Grafía del apellido «Rodríguez».
11. Revisión jurídica final de la política de privacidad y de los textos del área legal por parte de Tatiana.
