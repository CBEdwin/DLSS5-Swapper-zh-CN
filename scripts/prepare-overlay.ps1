$ErrorActionPreference = 'Stop'
$appRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$toolsDir = Join-Path $appRoot 'tools'
$sdkDir = Join-Path $toolsDir 'reshade-6.8.0'
New-Item -ItemType Directory -Force -Path $toolsDir, $sdkDir | Out-Null

# Official, pinned portable toolchain. No machine-wide installation or PATH changes.
$archive = Join-Path $toolsDir 'zig-0.14.1.zip'
$compiler = Join-Path $toolsDir 'zig-x86_64-windows-0.14.1/zig.exe'
if (!(Test-Path -LiteralPath $compiler)) {
    if (!(Test-Path -LiteralPath $archive)) {
        Invoke-WebRequest 'https://ziglang.org/download/0.14.1/zig-x86_64-windows-0.14.1.zip' -OutFile $archive
    }
    $stream = [IO.File]::OpenRead($archive)
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { $digest = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $stream.Dispose(); $hasher.Dispose() }
    if ($digest -ne '554f5378228923ffd558eac35e21af020c73789d87afeabf4bfd16f2e6feed2c') {
        throw 'Zig archive checksum mismatch. Nothing was executed.'
    }
    Expand-Archive -LiteralPath $archive -DestinationPath $toolsDir -Force
}

$revision = '18deaa52de0c425a78b329e9cb3c497281cd00ec'
$headers = @('reshade.hpp', 'reshade_api.hpp', 'reshade_api_device.hpp', 'reshade_api_format.hpp', 'reshade_api_pipeline.hpp', 'reshade_api_resource.hpp', 'reshade_events.hpp', 'reshade_overlay.hpp')
foreach ($header in $headers) {
    Invoke-WebRequest "https://raw.githubusercontent.com/crosire/reshade/$revision/include/$header" -OutFile (Join-Path $sdkDir $header)
}
Invoke-WebRequest "https://raw.githubusercontent.com/crosire/reshade/$revision/LICENSE.md" -OutFile (Join-Path $sdkDir 'LICENSE-ReShade.md')
$imguiRevision = '3912b3d9a9c1b3f17431aebafd86d2f40ee6e59c'
foreach ($header in @('imgui.h', 'imconfig.h', 'LICENSE.txt')) {
    $name = if ($header -eq 'LICENSE.txt') { 'LICENSE-ImGui.txt' } else { $header }
    Invoke-WebRequest "https://raw.githubusercontent.com/ocornut/imgui/$imguiRevision/$header" -OutFile (Join-Path $sdkDir $name)
}
Write-Output "Portable compiler and pinned ReShade SDK ready in $toolsDir"
