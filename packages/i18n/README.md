# @genpm/i18n

Catálogos de traducción (ICU MessageFormat) y utilidades de idioma compartidas por CLI, web, registry y core. Sin I/O.

- Idiomas: nivel 1 `en` (fuente), `es`, `pt-BR` · nivel 2 (beta) `fr`, `de`, `ja`, `zh-CN`, `ko`.
- `createT(locale, namespaces)` con claves y parámetros tipados (generados desde `locales/en`).
- `negotiate()` para `Accept-Language`, `--lang`, `GENPM_LANG`, `LANG`.
- `format.*` sobre `Intl` (números, fechas relativas, listas, bytes, duración).
- Los códigos `E_*`, claves del manifiesto y salidas `--json` **nunca** se traducen.

Spec: [docs/i18n.md](../../docs/i18n.md)
