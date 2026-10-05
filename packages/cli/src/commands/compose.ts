// `genpm compose <receta>` (V03-05): instala de una vez los paquetes de una receta (slug del registry o archivo JSON
// local) con el mismo plan, confirmaciones y consentimientos que `genpm add`. `--list` muestra las del registry.

import { listRecipes, loadRecipe } from '@genpm/core';
import { defineCommand } from 'citty';
import { type Ctx, coreOptions } from '../context.js';
import { json, line, reportError, table } from '../output.js';
import { addArgs, runAdd } from './add.js';
import { globalArgs } from './shared.js';

export const composeCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'compose', description: ctx.t.t('cli.desc.compose') },
    args: {
      recipe: { type: 'positional', description: ctx.t.t('cli.arg.recipe'), required: false },
      list: { type: 'boolean', description: ctx.t.t('cli.arg.listRecipes') },
      ...addArgs(ctx),
      ...globalArgs(ctx),
    },
    async run({ args }) {
      try {
        const opts = await coreOptions(ctx);
        if (args.list || !args.recipe) {
          const all = await listRecipes(opts);
          if (ctx.flags.json) return json({ ok: true, recipes: all });
          if (!all.length) return line(ctx, ctx.t.t('cli.compose.none'));
          for (const l of table(all.map((r) => [ctx.c.bold(r.name), r.summary ?? '', ctx.c.dim(r.p.join(' '))])))
            line(ctx, l);
          line(ctx);
          line(ctx, ctx.c.dim(ctx.t.t('cli.compose.hint')));
          return;
        }
        const recipe = await loadRecipe({ ...opts, recipe: args.recipe, locale: ctx.t.locale });
        await runAdd(ctx, recipe.specs, args, `genpm compose ${recipe.name} → ${recipe.specs.join(' ')}`);
      } catch (e) {
        reportError(ctx, e);
      }
    },
  });
