import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { initDb } from './db.js';

await initDb();
const port = Number(process.env.PORT ?? 3000);
serve({ fetch: createApp().fetch, port }, () => console.log(`genpm-example-saas listening on http://localhost:${port}`));
