# Kit de lanzamiento (Día 7)

Borradores listos para publicar. Los publica el fundador desde sus cuentas: nada de esto se envía solo.
Base: [branding §9](../branding.md#9-mensajes-de-lanzamiento). Los textos de idiomas de nivel 2 (ja, zh-CN, ko, fr, de)
llevan la marca **pendiente de revisión nativa** hasta que un nativo los lea (`D7-06`).

| Pieza | Archivo | Tarea | Cuándo |
|---|---|---|---|
| Guion del vídeo demo (90–120 s) | [demo-script.md](demo-script.md) | D7-01 | Grabar antes de todo lo demás |
| GIFs del README y redes | [`gifs/add.gif`](gifs/add.gif), [`gifs/lock.gif`](gifs/lock.gif) | D7-02 | Regenerar tras cada release: `cd gifs && vhs add.tape && vhs lock.tape` (genpm en el PATH) |
| Vídeos cortos para redes (reglas de producción) | [social-videos.md](social-videos.md) | — | Cada vídeo de la serie |
| Show HN | [show-hn.md](show-hn.md) | D7-03 | Martes a jueves, 15:00–17:00 CET |
| Hilo de X | [x-thread.md](x-thread.md) | D7-04 | Justo después de Show HN |
| LinkedIn | [linkedin.md](linkedin.md) | D7-05 | El mismo día |
| Comunidades por idioma | [communities.md](communities.md) | D7-06 | Escalonado: es el día 1, el resto en la semana |

## Antes de publicar

- [ ] `https://genpm.net` y `https://api.genpm.net/v1/health` en verde; `npx @genpm-net/cli search auth` < 1 s.
- [ ] CI en verde (GitHub Actions necesita la facturación al día).
- [ ] Contadores de instalaciones activos (`CF_AE_TOKEN`), si no las páginas muestran 0.
- [ ] Alguien atento a GitHub Issues, Discord y el correo durante las primeras 6 h (`D7-07`, `D7-08`).
- [ ] Decidida la apertura del código (`D6-P-07`): en Show HN la primera pregunta será "¿es open source?".

## Respuestas preparadas (HN y redes)

- **¿Por qué no shadcn/ui o copiar y pegar?** shadcn copia componentes de UI; GenPM copia módulos de backend completos
  con dependencias entre ellos (`@core/billing` trae `@core/auth` y `@core/db`), los ancla a un commit verificado con
  firma, escanea las reglas para IA y deja un lockfile para auditar y actualizar.
- **¿Y si el autor cambia el repo?** Se instala un SHA concreto, no una rama; el registry firma el manifiesto (Ed25519)
  y el CLI verifica SHA y firma. Si alguien mueve el tag, el registry lo detecta (`E_REPO_CHANGED`).
- **¿Ejecuta scripts?** Nunca. No hay `postinstall`; el escáner rechaza archivos que se ejecutan solos (`.envrc`,
  `.vscode/tasks.json`, hooks de git…).
- **¿Prompt injection en las reglas?** Se escanean al publicar y al instalar, el MCP las presenta como contenido de
  terceros y se pueden leer antes de instalar (`genpm info`). Es un riesgo residual y lo decimos (security §11).
- **¿Cómo se actualiza si he editado el código?** v0.1: `genpm outdated` y reinstalar; v0.2 trae `genpm diff`/`update`
  con merge de 3 vías asistido por IA.
