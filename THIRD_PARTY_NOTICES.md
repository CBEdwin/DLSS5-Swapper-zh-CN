# Third-party notices

## OptiScaler DLSS-NR (optional download)

OptiScaler DLSS-NR is an independently licensed project, not part of this
application's MIT-licensed implementation:
https://github.com/Dagherbou/OptiScaler_DLSSNR

A second, independently licensed project is offered per game: the pre-SR
multipass fork of the same idea, pinned at the DLSS5-Feeder author's build of
it. Everything below applies to both.
https://github.com/wilsjo2/OptiScaler-DLSSNR-PreSR-Multipass
https://github.com/jlrouzies-fr/OptiScaler-DLSSNR-PreSR-Multipass

The optional backend downloads the official archive of the build a game names
directly from its release page, with a pinned SHA-256 checksum. No upstream
executable, DLL or source is bundled with Swapper, and its setup/removal
scripts are not executed. Upstream binaries remain unmodified; configuration
and tracked deployment are performed by this application.

The upstream GNU GPL version 3 licence (commit 393e070) is downloaded and
checksum-verified separately because it is not included in Dagherbou's release
ZIP; the pre-SR fork carries its own copy inside the archive the pinned digest
already covers, and the fork's PeripheralWarp and FidelityFX v1 notices travel
with it.
The licence, RenoDX attribution, and supplied DirectX/FidelityFX/XeSS notices
are retained in the cache and copied into `OptiScaler/licenses` in the game.
Corresponding upstream source: https://github.com/Dagherbou/OptiScaler_DLSSNR/tree/393e070
Corresponding upstream source for the fork:
https://github.com/jlrouzies-fr/OptiScaler-DLSSNR-PreSR-Multipass/tree/v0.8.92

NVIDIA's Neural Rendering runtime is not supplied by this OptiScaler release.
This integration uses the existing Swapper payload's `nvngx_dlssnr.dll`; it
does not relicense that file or imply NVIDIA support for the integration.

## DLSS5-Feeder

The bundled client add-ons, 64-bit helper, shader and diagnostic verifier are
from the official DLSS5-Feeder v1.17.0 release:
https://github.com/jlrouzies-fr/DLSS5-Feeder/releases/tag/v1.17.0

The project's MIT licence is included in payload/feeder/licenses/DLSS5-Feeder-LICENSE.txt.
Release archive and component checksums are pinned in src/core/feeder-release.js.

## RenoDX DLSS 5 add-ons

Two builds of ShortFuse's RenoDX neural consumer are bundled: the generic
DLSS 5 add-on that every route installs, and the DLSS Tool build that the
multipass route installs in its place.
https://github.com/clshortfuse/renodx

Both are redistributed from the community release repository the upstream
Feeder installer also draws on, and each is pinned by release URL and digest in
src/core/renodx-release.js:
https://github.com/RankFTW/rhi-repo/releases

## dgVoodoo2

dgVoodoo2 is a separately licensed runtime dependency for DX8/DX9 translation:
https://github.com/dege-diosg/dgVoodoo2
https://dege.freeweb.hu/dgVoodoo2/ReadmeGeneral/

Its binaries are not bundled with this application. When a DX8/DX9 installation
is requested, the application downloads the complete official v2.87.5 archive,
verifies its pinned SHA-256 checksum and retains the original documentation
and licence in its component cache. dgVoodoo2 remains under its author's
licence, not this application's MIT licence.

## DLSS5-Autopilot

The emulator profile table and parts of the Vulkan/Feeder installation model
were adapted from DLSS5-Autopilot:
https://github.com/Kizzuwatnaa/DLSS5-Autopilot

MIT License

Copyright (c) 2026 DLSS 5 Autopilot contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

DLSS5-Autopilot downloads third-party components at runtime. Those components
remain under their own licences.
