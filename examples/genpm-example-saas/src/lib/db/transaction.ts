import { type Db, getDb, type Tx } from './client.js';

/**
 * Ejecuta `fn` en una transacción: si lanza, se hace rollback de todo. Los helpers de otros módulos aceptan un
 * `Executor`, así que pásales `tx` para que participen en la misma transacción.
 */
export function withTransaction<T>(fn: (tx: Tx) => Promise<T>, db: Db = getDb()): Promise<T> {
  return db.transaction((tx) => fn(tx as Tx));
}
