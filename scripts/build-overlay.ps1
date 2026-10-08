param([switch]$Smoke, [switch]$RenoDxProbe)
$ErrorActionPreference = 'Stop'
$appRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
# The add-on reads its endpoint, hotkey file and pipe name from this %APPDATA%
# folder. It must match the app's userData directory or the overlay loads in the
# game and then waits for a bridge that is writing somewhere else.
$overlayProfile = 'dlss5-swapper'
# The SDK and compiler normally sit in tools/ here; a checkout that shares one
# toolchain with a sibling project is searched second.
$toolRoots = @($appRoot, (Join-Path $appRoot '../lab'))
$zig = $toolRoots | ForEach-Object { Join-Path $_ 'tools/zig-x86_64-windows-0.14.1/zig.exe' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
$sdk = $toolRoots | ForEach-Object { Join-Path $_ 'tools/reshade-6.8.0' } | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'reshade.hpp') } | Select-Object -First 1
if (!$zig -or !$sdk) { throw 'Run npm run overlay:prepare first.' }
$profileDefine = '-DLAB_OVERLAY_PROFILE=' + $overlayProfile
$output = Join-Path $appRoot $(if ($RenoDxProbe) { 'dist/renodx-probe' } elseif ($Smoke) { 'dist/overlay-smoke' } else { 'dist/overlay' })
New-Item -ItemType Directory -Force -Path $output | Out-Null
$env:ZIG_GLOBAL_CACHE_DIR = Join-Path $appRoot 'tools/zig-cache'
$env:ZIG_LOCAL_CACHE_DIR = Join-Path $appRoot 'tools/zig-local-cache'
# Compile the tiny ImVec2 return adapter with ReShade's MSVC ABI, without CRT.
$abiObject = Join-Path $output 'imgui-abi.obj'
& $zig cc -target x86_64-windows-msvc -x c++ -std=c++17 -O2 -fno-exceptions -fno-rtti -nostdinc -nostdlib -c (Join-Path $appRoot 'overlay/imgui-abi.cpp') -o $abiObject
if ($LASTEXITCODE -ne 0) { throw 'ImGui ABI adapter compilation failed.' }
$arguments = @('c++', '-target', 'x86_64-windows-gnu', '-std=c++17', '-O2', '-shared', '-static', '-fms-extensions', '-DWIN32_LEAN_AND_MEAN', '-DNOMINMAX', $profileDefine, '-I', $sdk, (Join-Path $appRoot 'overlay/overlay.cpp'), '-o', (Join-Path $output 'dlss5-lab-overlay.addon64'))
if ($Smoke) { $arguments += '-DLAB_OVERLAY_SMOKE' }
if ($RenoDxProbe) { $arguments += @('-DLAB_RENODX_PROBE', '-ladvapi32') }
$arguments += @($abiObject, '-ladvapi32')
& $zig @arguments
if ($LASTEXITCODE -ne 0) { throw 'Overlay compilation failed.' }
Copy-Item -LiteralPath (Join-Path $sdk 'LICENSE-ReShade.md'), (Join-Path $sdk 'LICENSE-ImGui.txt') -Destination $output
Copy-Item -LiteralPath (Join-Path $appRoot 'overlay/README.md') -Destination $output
Copy-Item -LiteralPath (Join-Path $appRoot 'overlay/LICENSE') -Destination $output
$builtFile = Join-Path $output 'dlss5-lab-overlay.addon64'
$stream = [IO.File]::OpenRead($builtFile)
$hasher = [Security.Cryptography.SHA256]::Create()
try { $hash = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
finally { $stream.Dispose(); $hasher.Dispose() }
Write-Output "Built $builtFile (SHA-256 $hash)"
