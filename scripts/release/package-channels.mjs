#!/usr/bin/env node
// Fórmula de Homebrew y manifiesto de Scoop del binario nativo (V011-04) a partir del SHA256SUMS de un release.
//
//   node scripts/release/package-channels.mjs <versión> <SHA256SUMS> <dir-homebrew-tap> <dir-scoop-bucket>
//
// Escribe <tap>/Formula/genpm.rb y <bucket>/bucket/genpm.json. Los binarios se descargan de
// github.com/GenPM-net/genpm-releases (ADR-025); Homebrew y Scoop verifican el SHA-256.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [version, sumsFile, tapDir, bucketDir] = process.argv.slice(2);
if (!version || !sumsFile || !tapDir || !bucketDir) {
  console.error('usage: package-channels.mjs <version> <SHA256SUMS> <homebrew-tap-dir> <scoop-bucket-dir>');
  process.exit(1);
}
const sums = Object.fromEntries(
  readFileSync(sumsFile, 'utf8')
    .trim()
    .split('\n')
    .map((l) => l.trim().split(/\s+\*?/))
    .map(([hash, file]) => [file, hash]),
);
const need = (f) => {
  if (!sums[f]) {
    console.error(`missing ${f} in SHA256SUMS`);
    process.exit(1);
  }
  return sums[f];
};
const base = `https://github.com/GenPM-net/genpm-releases/releases/download/v${version}`;

const formula = `# Generado por scripts/release/package-channels.mjs (repo GenPM-net/genpm). No editar a mano.
class Genpm < Formula
  desc "Install architectures, not dependencies: inject code, AI rules and MCP config"
  homepage "https://genpm.net"
  license "MIT"

  on_macos do
    on_arm do
      url "${base}/genpm-darwin-arm64"
      sha256 "${need('genpm-darwin-arm64')}"
    end
    on_intel do
      url "${base}/genpm-darwin-x64"
      sha256 "${need('genpm-darwin-x64')}"
    end
  end

  on_linux do
    on_arm do
      url "${base}/genpm-linux-arm64"
      sha256 "${need('genpm-linux-arm64')}"
    end
    on_intel do
      url "${base}/genpm-linux-x64"
      sha256 "${need('genpm-linux-x64')}"
    end
  end

  def install
    bin.install Dir["genpm-*"].first => "genpm"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/genpm --version")
  end
end
`;

const manifest = {
  version,
  description: 'Install architectures, not dependencies: inject code, AI rules and MCP config',
  homepage: 'https://genpm.net',
  license: 'MIT',
  architecture: {
    '64bit': { url: `${base}/genpm-windows-x64.exe#/genpm.exe`, hash: need('genpm-windows-x64.exe') },
    arm64: { url: `${base}/genpm-windows-arm64.exe#/genpm.exe`, hash: need('genpm-windows-arm64.exe') },
  },
  bin: 'genpm.exe',
  checkver: { github: 'https://github.com/GenPM-net/genpm-releases' },
  autoupdate: {
    architecture: {
      '64bit': {
        url: 'https://github.com/GenPM-net/genpm-releases/releases/download/v$version/genpm-windows-x64.exe#/genpm.exe',
      },
      arm64: {
        url: 'https://github.com/GenPM-net/genpm-releases/releases/download/v$version/genpm-windows-arm64.exe#/genpm.exe',
      },
    },
    hash: { url: 'https://github.com/GenPM-net/genpm-releases/releases/download/v$version/SHA256SUMS' },
  },
};

mkdirSync(join(tapDir, 'Formula'), { recursive: true });
writeFileSync(join(tapDir, 'Formula', 'genpm.rb'), formula);
mkdirSync(join(bucketDir, 'bucket'), { recursive: true });
writeFileSync(join(bucketDir, 'bucket', 'genpm.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Formula/genpm.rb and bucket/genpm.json for ${version}`);
