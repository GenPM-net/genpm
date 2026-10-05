// La app: monta las rutas de los módulos inyectados por genpm (src/lib/*) siguiendo sus AGENTS.md.
import { Hono } from 'hono';
import { aiRoutes } from './lib/ai/adapters/hono.js';
import { type AuthVariables, authRoutes, requireUser, sessionMiddleware } from './lib/auth/adapters/hono.js';
import { billingRoutes } from './lib/billing/adapters/hono.js';
import { hasEntitlement } from './lib/billing/index.js';
import { sendEmail } from './lib/email/index.js';

export function createApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use(sessionMiddleware);

  app.get('/health', (c) => c.json({ ok: true }));

  // @core/auth + @core/email: correo de bienvenida en el primer login.
  app.route(
    '/auth',
    authRoutes({
      onLogin: ({ user, isNewUser }) =>
        isNewUser && user.email
          ? sendEmail('welcome', { to: user.email, props: { name: user.name, appUrl: process.env.APP_URL ?? '' } }).then(
              () => undefined,
            )
          : undefined,
    }),
  );
  app.get('/api/me', requireUser, (c) => c.json(c.get('user')));

  // @core/billing: checkout, portal y webhook; y una ruta "pro" protegida por suscripción.
  app.route('/billing', billingRoutes());
  app.get('/api/pro', requireUser, async (c) => {
    const user = c.get('user');
    if (!user || !(await hasEntitlement(user, 'pro'))) return c.json({ error: 'upgrade' }, 402);
    return c.json({ secret: 'pro content' });
  });

  // @core/ai: chat en streaming, solo para usuarios con sesión.
  app.route('/ai', aiRoutes({ getUserId: (c) => (c.get('user') as AuthVariables['user'])?.id, requireUser: true }));

  return app;
}
