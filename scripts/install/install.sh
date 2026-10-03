#!/bin/sh
# GenPM installer for macOS and Linux (ADR-025). Served at https://genpm.net/install.sh
#
#   curl -fsSL https://genpm.net/install.sh | sh
#   curl -fsSL https://genpm.net/install.sh | sh -s -- 0.2.0      # a specific version
#
# Downloads the standalone genpm binary for this platform from GitHub Releases, verifies its SHA-256 against the
# release's SHA256SUMS and installs it in ~/.genpm/bin. Node.js is not needed. Nothing runs as root.
#
#   GENPM_INSTALL_DIR      install directory (default: ~/.genpm/bin)
#   GENPM_VERSION          version to install (default: latest; the first argument wins)
#   GENPM_NO_MODIFY_PATH=1 do not add the install directory to your shell profile
#   GENPM_DOWNLOAD_URL     base URL (or local directory) holding the release files, for mirrors
#
# Messages are in English only: this runs before genpm (and its translations) exist on the machine.
set -eu

REPO_URL="https://github.com/genpm-net/genpm"

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  BOLD="$(printf '\033[1m')" DIM="$(printf '\033[2m')" GREEN="$(printf '\033[32m')" RED="$(printf '\033[31m')" RESET="$(printf '\033[0m')"
else
  BOLD="" DIM="" GREEN="" RED="" RESET=""
fi

info() { printf '%s\n' "$*"; }
fail() {
  printf '%serror%s: %s\n' "$RED" "$RESET" "$*" >&2
  exit 1
}

detect_target() {
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Darwin) os="darwin" ;;
    Linux) os="linux" ;;
    MINGW* | MSYS* | CYGWIN*)
      fail "on Windows, run this in PowerShell instead: irm https://genpm.net/install.ps1 | iex"
      ;;
    *) fail "unsupported operating system: $os (GenPM supports macOS, Linux and Windows)" ;;
  esac
  case "$arch" in
    x86_64 | amd64) arch="x64" ;;
    arm64 | aarch64) arch="arm64" ;;
    *) fail "unsupported architecture: $arch (GenPM supports x64 and arm64)" ;;
  esac
  # A shell running under Rosetta 2 reports x86_64 on Apple silicon: install the native build.
  if [ "$os" = "darwin" ] && [ "$arch" = "x64" ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = "1" ]; then
    arch="arm64"
  fi
  target="$os-$arch"
  if [ "$os" = "linux" ]; then
    if ls /lib/ld-musl-* >/dev/null 2>&1 || (ldd --version 2>&1 | grep -qi musl); then
      target="$target-musl"
    fi
  fi
  printf '%s' "$target"
}

# download <url> <file>
download() {
  case "$1" in
    http://* | https://*)
      if command -v curl >/dev/null 2>&1; then
        curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 --retry 3 --output "$2" "$1"
      elif command -v wget >/dev/null 2>&1; then
        wget --quiet --https-only --tries=3 --output-document="$2" "$1"
      else
        fail "curl or wget is required"
      fi
      ;;
    *) cp "$1" "$2" ;; # GENPM_DOWNLOAD_URL pointing to a local directory
  esac
}

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d ' ' -f 1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d ' ' -f 1
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 -r "$1" | cut -d ' ' -f 1
  else
    fail "sha256sum, shasum or openssl is required to verify the download"
  fi
}

# Adds the install directory to the PATH in the profile of the user's shell (once).
add_to_path() {
  dir="$1"
  # Under $HOME, the profile keeps "$HOME/…" so it survives a renamed home directory.
  case "$dir" in
    "$HOME"/*) dir="\$HOME${dir#"$HOME"}" ;;
  esac
  line="export PATH=\"$dir:\$PATH\""
  case "$(basename "${SHELL:-sh}")" in
    zsh) profile="${ZDOTDIR:-$HOME}/.zshrc" ;;
    bash)
      if [ "$(uname -s)" = "Darwin" ]; then profile="$HOME/.bash_profile"; else profile="$HOME/.bashrc"; fi
      ;;
    fish)
      profile="${XDG_CONFIG_HOME:-$HOME/.config}/fish/conf.d/genpm.fish"
      line="fish_add_path \"$dir\""
      ;;
    *) profile="$HOME/.profile" ;;
  esac
  if [ -f "$profile" ] && grep -qF "$dir" "$profile"; then
    printf '%s' "$profile"
    return
  fi
  mkdir -p "$(dirname "$profile")"
  printf '\n# genpm\n%s\n' "$line" >>"$profile"
  printf '%s' "$profile"
}

main() {
  version="${1:-${GENPM_VERSION:-}}"
  version="${version#v}"
  install_dir="${GENPM_INSTALL_DIR:-$HOME/.genpm/bin}"
  target="$(detect_target)"
  asset="genpm-$target"

  if [ -n "${GENPM_DOWNLOAD_URL:-}" ]; then
    base="${GENPM_DOWNLOAD_URL%/}"
  elif [ -n "$version" ]; then
    base="$REPO_URL/releases/download/v$version"
  else
    base="$REPO_URL/releases/latest/download"
  fi

  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT INT TERM

  info "${DIM}Downloading $asset${version:+ $version}…${RESET}"
  download "$base/$asset" "$tmp/$asset" || fail "could not download $base/$asset"
  download "$base/SHA256SUMS" "$tmp/SHA256SUMS" || fail "could not download $base/SHA256SUMS"

  expected="$(awk -v f="$asset" '$2 == f || $2 == "*" f { print $1 }' "$tmp/SHA256SUMS")"
  [ -n "$expected" ] || fail "$asset is not listed in SHA256SUMS"
  actual="$(sha256 "$tmp/$asset")"
  if [ "$actual" != "$expected" ]; then
    fail "checksum mismatch for $asset (expected $expected, got $actual). Nothing was installed."
  fi

  mkdir -p "$install_dir"
  chmod 755 "$tmp/$asset"
  mv -f "$tmp/$asset" "$install_dir/genpm"
  if ! installed="$("$install_dir/genpm" --version 2>/dev/null)"; then
    case "$target" in
      *-musl) fail "genpm needs the C++ runtime on musl systems: run 'apk add libstdc++ libgcc' and try again" ;;
      *) fail "the downloaded binary does not run on this system ($target)" ;;
    esac
  fi

  info "${GREEN}✔${RESET} ${BOLD}genpm $installed${RESET} installed in $install_dir/genpm ${DIM}(SHA-256 verified)${RESET}"

  case ":$PATH:" in
    *":$install_dir:"*) ;;
    *)
      if [ "${GENPM_NO_MODIFY_PATH:-}" = "1" ]; then
        info ""
        info "Add it to your PATH:  export PATH=\"$install_dir:\$PATH\""
      else
        profile="$(add_to_path "$install_dir")"
        info "${DIM}Added $install_dir to your PATH in $profile${RESET}"
        info ""
        info "Open a new terminal (or run: export PATH=\"$install_dir:\$PATH\"), then:"
      fi
      ;;
  esac
  info ""
  info "  ${BOLD}genpm add @core/auth${RESET}     add your first module"
  info "  ${BOLD}genpm mcp setup${RESET}          let your AI agent install modules"
  info "  ${BOLD}genpm upgrade${RESET}            update genpm later"
}

# Everything runs inside main: a truncated download never executes a partial script.
main "$@"
