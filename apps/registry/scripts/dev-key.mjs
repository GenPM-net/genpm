// Clave de firma de DESARROLLO (pública a propósito). El CLI solo la acepta contra registries en localhost
// (packages/core/src/keys.ts). Nunca se configura en staging ni en producción.
export const DEV_KEY = {
  id: 'dev1',
  private: 'MC4CAQAwBQYDK2VwBCIEIOhGZe7H5iw7JA8I_W8VqG4sSOjwdSiRocgtz-5_Er1J',
  public: 'ZSTMDFblyaEtVTOS3OAY6ZCDKaA7BT0VIBhT7N7CmsU',
};
