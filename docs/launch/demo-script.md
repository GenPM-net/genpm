# Guion del vídeo demo (90–120 s)

Objetivo (PLAN §1): un desarrollador pide a su agente la base de un SaaS y GenPM la deja integrada sin editar código a
mano. Debe cumplir los 5 criterios de éxito (`D7-G-01`). Grabación a 1920×1080, terminal con fuente de 18 px, tema claro.

| t | Pantalla | Voz / texto en pantalla |
|---|---|---|
| 0–8 s | Carpeta vacía en el editor | "Empiezo un SaaS desde cero. No voy a escribir auth ni pagos." |
| 8–18 s | `curl -fsSL https://genpm.net/install.sh \| sh` y `genpm mcp setup --client claude` | "Instalo GenPM y lo conecto a mi agente." |
| 18–26 s | `genpm search auth` (responde en < 1 s, criterio 1) | "El registry público ya tiene los módulos." |
| 26–55 s | En Claude Code: "Crea la base de un SaaS: base de datos, login con GitHub, suscripciones con Stripe y emails" → el agente llama a `genpm_search`, `genpm_info` y `genpm_add` con `dryRun` y enseña el plan | "Busca, lee las reglas y me enseña el plan antes de tocar nada." |
| 55–70 s | El agente pide permiso para el MCP de Stripe y para `npm install`; acepto (criterio 3) | "El MCP de Stripe solo se añade si yo digo que sí." |
| 70–85 s | `tree src/lib`, `genpm.lock` con los SHA, `src/lib/billing/AGENTS.md` | "Código real en mi repo, anclado a un commit y con reglas para la IA." |
| 85–100 s | El agente integra las rutas siguiendo "Integration"; `npx tsc` sin errores; `GET /auth/login/github` redirige | "Integrado y compilando, sin que yo edite una línea." |
| 100–115 s | genpm.net/publish: elijo un repo, todo en verde, "Publicar"; aparece en la web (criterio 4) | "¿Tienes un módulo propio? Publícalo en un minuto." |
| 115–120 s | Logo + `genpm.net` | "GenPM. Instala arquitecturas, no dependencias." |

Criterio 2 (`genpm add @core/billing` instala billing + auth + db, escribe contexto y propone `npm install`) y criterio 5
(las 5 semillas con escaneo `passed`) se ven en pantalla en 70–85 s y en la página de cada paquete.

**Toma de apoyo para redes:** los GIFs de [`gifs/`](gifs/) cubren 18–26 s y 70–85 s sin voz.
