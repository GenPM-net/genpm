declare module '*.bin' {
  const data: ArrayBuffer;
  export default data;
}
declare module '*.wasm' {
  const mod: WebAssembly.Module;
  export default mod;
}
