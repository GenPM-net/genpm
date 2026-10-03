// Instaladores del binario nativo (ADR-025). La fuente única vive en scripts/install/ (probada en CI con los binarios
// del release); la web solo la sirve como texto plano en /install.sh y /install.ps1.
import ps1 from '../../../../scripts/install/install.ps1?raw';
import sh from '../../../../scripts/install/install.sh?raw';

export const INSTALLERS = { sh, ps1 } as const;

/** Comandos de instalación que muestran la portada y la documentación (no se traducen). */
export const INSTALL_COMMANDS = {
  unix: 'curl -fsSL https://genpm.net/install.sh | sh',
  windows: 'irm https://genpm.net/install.ps1 | iex',
} as const;

export function installerResponse(body: string): Response {
  return new Response(body, {
    headers: {
      // text/plain: `irm` lo devuelve como cadena para `iex` y el navegador lo muestra en vez de descargarlo.
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
