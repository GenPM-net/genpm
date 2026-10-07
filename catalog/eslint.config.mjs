// La configuración por defecto de create-next-app (next/core-web-vitals + next/typescript): `next build` la aplica en
// el proyecto del usuario, así que el código de los paquetes y kits debe pasarla sin overrides.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  { ignores: ['node_modules/**', '.next/**', 'next-env.d.ts', 'scripts/**', 'e2e/**', '**/*.test.ts', '**/*.test.tsx', '**/__fixtures__/**'] },
];
