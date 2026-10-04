# GenPM installer for Windows (ADR-025). Served at https://genpm.net/install.ps1
#
#   irm https://genpm.net/install.ps1 | iex
#   & ([scriptblock]::Create((irm https://genpm.net/install.ps1))) -Version 0.2.0    # a specific version
#
# Downloads the standalone genpm.exe for this machine from GitHub Releases, verifies its SHA-256 against the release's
# SHA256SUMS and installs it in %USERPROFILE%\.genpm\bin (added to the user PATH). Node.js and admin rights are not needed.
#
#   GENPM_INSTALL_DIR      install directory (default: %USERPROFILE%\.genpm\bin)
#   GENPM_VERSION          version to install (default: latest; -Version wins)
#   GENPM_NO_MODIFY_PATH=1 do not add the install directory to the user PATH
#   GENPM_DOWNLOAD_URL     base URL (or local directory) holding the release files, for mirrors
#
# Messages are in English only: this runs before genpm (and its translations) exist on the machine.
# Never calls `exit`: piped into `iex`, that would close the user's terminal.

param(
  [string]$Version = $env:GENPM_VERSION,
  [string]$InstallDir = $env:GENPM_INSTALL_DIR,
  [switch]$NoModifyPath = ($env:GENPM_NO_MODIFY_PATH -eq '1')
)

function Install-Genpm {
  param([string]$Version, [string]$InstallDir, [bool]$NoModifyPath)

  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue' # Invoke-WebRequest is much slower with the progress bar
  # Windows PowerShell 5.1 may default to TLS 1.0, which GitHub rejects.
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

  $arch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
  switch ($arch) {
    'AMD64' { $target = 'windows-x64' }
    'ARM64' { $target = 'windows-arm64' }
    default { Write-Error "Unsupported architecture: $arch (GenPM supports x64 and arm64)"; return }
  }
  $asset = "genpm-$target.exe"
  $repo = 'https://github.com/genpm-net/genpm-releases'
  $Version = "$Version".TrimStart('v')
  if ($env:GENPM_DOWNLOAD_URL) { $base = $env:GENPM_DOWNLOAD_URL.TrimEnd('/', '\') }
  elseif ($Version) { $base = "$repo/releases/download/v$Version" }
  else { $base = "$repo/releases/latest/download" }
  if (-not $InstallDir) { $InstallDir = Join-Path $HOME '.genpm\bin' }

  $tmp = Join-Path ([IO.Path]::GetTempPath()) ("genpm-" + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp -Force | Out-Null
  try {
    $label = if ($Version) { "$asset $Version" } else { $asset }
    Write-Host "Downloading $label..." -ForegroundColor DarkGray
    foreach ($file in @($asset, 'SHA256SUMS')) {
      $src = "$base/$file"
      $dst = Join-Path $tmp $file
      if ($src -match '^https?://') {
        try { Invoke-WebRequest -Uri $src -OutFile $dst -UseBasicParsing }
        catch { Write-Error "Could not download ${src}: $($_.Exception.Message)"; return }
      } else {
        Copy-Item -Path (Join-Path $base $file) -Destination $dst
      }
    }

    $expected = $null
    foreach ($line in Get-Content (Join-Path $tmp 'SHA256SUMS')) {
      if ($line -match '^([0-9a-fA-F]{64}) [ *]?(\S+)$' -and $Matches[2] -eq $asset) { $expected = $Matches[1].ToLower() }
    }
    if (-not $expected) { Write-Error "$asset is not listed in SHA256SUMS"; return }
    $actual = (Get-FileHash -Algorithm SHA256 -Path (Join-Path $tmp $asset)).Hash.ToLower()
    if ($actual -ne $expected) {
      Write-Error "Checksum mismatch for $asset (expected $expected, got $actual). Nothing was installed."
      return
    }

    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    $exe = Join-Path $InstallDir 'genpm.exe'
    # A running genpm.exe cannot be overwritten but can be renamed; genpm deletes the .old file on its next start.
    if (Test-Path $exe) {
      Remove-Item "$exe.old" -Force -ErrorAction SilentlyContinue
      Move-Item -Path $exe -Destination "$exe.old" -Force
    }
    Move-Item -Path (Join-Path $tmp $asset) -Destination $exe -Force
    $installed = (& $exe --version) 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $installed) { Write-Error "The downloaded binary does not run on this system ($target)"; return }
  } finally {
    Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }

  Write-Host ([char]0x2714) -ForegroundColor Green -NoNewline
  Write-Host " genpm $installed installed in $exe " -NoNewline
  Write-Host '(SHA-256 verified)' -ForegroundColor DarkGray

  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $inPath = ($userPath -split ';') -contains $InstallDir
  if (-not $inPath) {
    if ($NoModifyPath) {
      Write-Host ''
      Write-Host "Add $InstallDir to your PATH to run genpm from any terminal."
    } else {
      $newPath = if ($userPath) { "$InstallDir;$userPath" } else { $InstallDir }
      [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
      Write-Host "Added $InstallDir to your user PATH. Open a new terminal to use genpm everywhere." -ForegroundColor DarkGray
    }
  }
  if (-not (($env:Path -split ';') -contains $InstallDir)) { $env:Path = "$InstallDir;$env:Path" }

  Write-Host ''
  Write-Host '  genpm search auth        find a module to add'
  Write-Host '  genpm mcp setup          let your AI agent install modules'
  Write-Host '  genpm upgrade            update genpm later'
}

Install-Genpm -Version $Version -InstallDir $InstallDir -NoModifyPath $NoModifyPath.IsPresent
