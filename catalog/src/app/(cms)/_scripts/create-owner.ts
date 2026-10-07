// Da el rol `owner` al primer usuario (instalación). El usuario debe haber iniciado sesión una vez en /admin/login.
// Uso (lo ejecuta la persona, con DATABASE_URL del entorno): npx tsx "src/app/(cms)/_scripts/create-owner.ts" <email>
import { sql } from 'drizzle-orm';
import { users } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { bootstrapOwner } from '@/lib/rbac';

export async function createOwner(email: string): Promise<'created' | 'exists' | 'no_user'> {
  const [user] = await getDb().select().from(users).where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`);
  if (!user) return 'no_user';
  return (await bootstrapOwner(user.id)) ? 'created' : 'exists';
}

// Sin top-level await: tsx compila a CommonJS en proyectos sin "type": "module" (lo normal en Next).
const isMain = typeof process !== 'undefined' && process.argv[1]?.endsWith('create-owner.ts');
if (isMain) {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: create-owner <email>');
    process.exit(1);
  }
  const messages = {
    created: `${email} is now the owner. Open /admin.`,
    exists: 'The site already has an owner: ask them to grant you a role in Admin → Users.',
    no_user: `No user with email ${email}. Sign in once at /admin/login, then run this again.`,
  };
  createOwner(email).then((r) => {
    console.log(messages[r]);
    process.exit(r === 'no_user' ? 1 : 0);
  }, (e) => {
    console.error(e);
    process.exit(1);
  });
}
