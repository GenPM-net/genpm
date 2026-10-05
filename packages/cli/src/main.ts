// Árbol de comandos del CLI. Se construye después de resolver el idioma para traducir la ayuda (i18n §4.5).

import { cleanupOldBinary, VERSION } from '@genpm/core';
import { defineCommand, runMain } from 'citty';
import { add } from './commands/add.js';
import { initCmd, loginCmd, logoutCmd, publishCmd, validateCmd, whoamiCmd, yankCmd } from './commands/author.js';
import {
  auditCmd,
  cacheCmd,
  doctorCmd,
  infoCmd,
  listCmd,
  outdatedCmd,
  removeCmd,
  searchCmd,
} from './commands/consumer.js';
import { mcpCmd } from './commands/mcp.js';
import { diffCmd, updateCmd } from './commands/update.js';
import { upgradeCmd } from './commands/upgrade.js';
import { type Ctx, createContext } from './context.js';
import { reportError } from './output.js';

export function buildCli(ctx: Ctx) {
  return defineCommand({
    meta: { name: 'genpm', version: VERSION, description: ctx.t.t('cli.desc.root') },
    subCommands: {
      add: add(ctx),
      search: searchCmd(ctx),
      info: infoCmd(ctx),
      list: listCmd(ctx),
      ls: listCmd(ctx),
      remove: removeCmd(ctx),
      rm: removeCmd(ctx),
      outdated: outdatedCmd(ctx),
      update: updateCmd(ctx),
      diff: diffCmd(ctx),
      audit: auditCmd(ctx),
      doctor: doctorCmd(ctx),
      mcp: mcpCmd(ctx),
      init: initCmd(ctx),
      validate: validateCmd(ctx),
      publish: publishCmd(ctx),
      yank: yankCmd(ctx),
      login: loginCmd(ctx),
      logout: logoutCmd(ctx),
      whoami: whoamiCmd(ctx),
      cache: cacheCmd(ctx),
      upgrade: upgradeCmd(ctx),
    },
  });
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const [major, minor] = process.versions.node.split('.').map(Number) as [number, number];
  const ctx = await createContext(argv);
  // Restos de un `genpm upgrade` en Windows (el .exe en uso solo se puede renombrar).
  await cleanupOldBinary();
  if (major < 20 || (major === 20 && minor < 11)) {
    const { fail } = await import('@genpm/core');
    reportError(ctx, fail('E_NODE_VERSION', { version: process.versions.node }));
    return;
  }
  // Sin subcomando reconocido citty muestra la ayuda; los errores de cada comando ya se reportan con su exit code.
  await runMain(buildCli(ctx), { rawArgs: argv });
}
