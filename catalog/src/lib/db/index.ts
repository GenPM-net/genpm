// @core/db — API pública. Importa siempre desde aquí: `import { getDb, withTransaction } from '../db/index.ts'`.
export { createDb, type Db, type Executor, getDb, setDb, type Tx } from './client.ts';
export { primaryId, timestamps } from './columns.ts';
export { withTransaction } from './transaction.ts';
export { newId, ulid, ulidTime } from './ulid.ts';
