#!/usr/bin/env node
import { main } from './main.js';

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
});
