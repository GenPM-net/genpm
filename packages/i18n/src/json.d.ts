// Los catálogos se importan con atributos JSON; tsc no debe copiarlos ni tiparlos fila a fila (keys.gen.ts ya lo hace).
declare module '*.json' {
  const value: Record<string, unknown>;
  export default value;
}
