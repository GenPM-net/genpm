#!/usr/bin/env node
import { main } from './main.js';

// `genpm … | head`: si el lector cierra la tubería, salir en silencio. Node emite 'error' en stdout; el binario
// nativo (Bun, ADR-025) lanza EPIPE de forma síncrona desde write().
const isEpipe = (e: unknown) => (e as NodeJS.ErrnoException | null)?.code === 'EPIPE';
process.stdout.on('error', (e) => {
  if (isEpipe(e)) process.exit(0);
  throw e;
});
const write = process.stdout.write.bind(process.stdout) as (...args: unknown[]) => boolean;
process.stdout.write = ((...args: unknown[]) => {
  try {
    return write(...args);
  } catch (e) {
    if (isEpipe(e)) process.exit(0);
    throw e;
  }
}) as typeof process.stdout.write;

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
});
