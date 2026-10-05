/// <reference types="astro/client" />
import type { Translator } from '@genpm/i18n';

type WebEnv = {
  REGISTRY?: Fetcher;
  EVENTS?: AnalyticsEngineDataset;
  ENVIRONMENT: string;
  SITE_ORIGIN: string;
  REGISTRY_URL: string;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  SESSION_PEPPER?: string;
};

declare global {
  namespace App {
    interface Locals {
      locale: import('@genpm/i18n').Locale;
      t: Translator;
      /** Ruta sin prefijo de idioma (`/p/@core/auth`). */
      path: string;
      session: { token: string; handle: string } | null;
      cfContext?: ExecutionContext;
    }
  }
  namespace Cloudflare {
    interface Env extends WebEnv {}
  }
}

declare module 'cloudflare:workers' {
  export const env: WebEnv;
}
