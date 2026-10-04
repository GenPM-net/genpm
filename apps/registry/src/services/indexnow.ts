// IndexNow (indexnow.org): avisa a Bing (y con él a ChatGPT search), Yandex, Seznam y Naver de páginas nuevas o
// cambiadas, sin cuenta en ningún buscador. La clave es pública por diseño y se sirve en <WEB_ORIGIN>/<clave>.txt.
import type { Env } from '../env.js';

export async function indexNow(env: Env, paths: string[]): Promise<void> {
  if (env.ENVIRONMENT !== 'production' || !env.INDEXNOW_KEY || !paths.length) return;
  const host = new URL(env.WEB_ORIGIN).host;
  await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host,
      key: env.INDEXNOW_KEY,
      keyLocation: `${env.WEB_ORIGIN}/${env.INDEXNOW_KEY}.txt`,
      urlList: paths.map((p) => `${env.WEB_ORIGIN}${p}`),
    }),
  }).catch(() => undefined); // best effort: nunca rompe una publicación
}
