# In-game overlay - experimental, unofficial

The app preview and in-game panel now use the **same HTML/CSS and Chromium
renderer**, including fonts, sliders, spacing and buttons. The native add-on
displays that interactive surface at 534 CSS pixels wide, without inheriting
ReShade's font or widget theme. **Not NVIDIA's official overlay or SDK.**

## What works

- **Overlay gallery:** Emerald (green), Azure (blue), Amethyst (purple).
  Cards are inert renderings of the same panel. **Preview** opens an interactive,
  demo-only dialog; preview edits never control a game or select a theme.
- **Install overlay with DLSS:** one persisted global switch. Off adds no overlay
  during future game installations and does not uninstall existing overlays.
  The DLSS backend selection remains independent of this switch.
- **Hotkey:** saved in `overlay-preferences.json` with the selected theme and switch.
  F8 is the default. Keyboard shortcuts can include Ctrl/Alt/Shift; Home and Escape
  remain reserved, and Windows-key shortcuts are not supported. The native add-on
  reads changes every half-second. Update the installed add-on once for this support.
  Selected colors reach the same Chromium surface displayed in-game while the app runs.

- **Overlay page**: interactive design preview, **Add** for custom `.addon64` /
  `.addon32` overlays, native-code warning, integrity-checked library copies.
- Install a test overlay next to a selected executable, without replacing any
  DLLs, presets, ReShade configuration, or Vulkan registry entries.
- Remove only the unchanged add-on this app installed. Original imports remain.
- Built-in x64 native ReShade add-on: **F8 by default** opens a compact, independent panel;
  **Escape** closes it and dragging the header moves it. **Home -> DLSS 5 Swapper**
  also offers an open button. Original ReShade and RenoDX tabs
  are kept. Built against ReShade **6.8.0 / API 20 / ImGui 1.92.5**.
- Mouse clicks/drags and keyboard controls are forwarded through a bounded,
  local named pipe. Only changed frames are uploaded. **Keep DLSS 5 Swapper running**;
  one test game connects at a time. Closing the app disconnects the UI safely.
- The installed overlay **automatically connects to the verified RenoDX
  v4.7 build**; there is no connect button. Unsupported binaries remain refused.
  Structure, global tone, NR on/off, character mask and skin structure use
  RenoDX's original UI callback, with its actual ranges and live readback.
- **A = Default, B = Natural, C = Cinematic** selects RenoDX's **NR Style**.
  These are style shortcuts, not separate NVIDIA AI models. Selection follows
  actual RenoDX readback, including changes made in its original window.
- **More RenoDX Controls** replaces the unsupported demo object groups with
  Overall/Local Tone, Diffuse White, Motion X/Y, UI Correction, Upscaling (WIP),
  NR Preset and Depth Convention. Scroll inside this section. Its ranges and
  choice labels come from the original callback, not guessed defaults.
- Click a numeric value to type it; Enter commits. Ctrl+A, Backspace, Delete,
  digits, decimal points and minus signs work through the in-game input channel.
  Compact dropdowns render their popup inside the shared Chromium texture,
  not a separate OS window. Mouse selection and keyboard navigation work there.
- **Live tools** also exposes separate ReShade FX controls. The app landing-page
  preview uses the **same current panel, controls, CSS and dropdown renderer**.
  Preview edits only change a local sample state; they never call game-control
  IPC. Object-specific masks are not provided by this adapter.

## Feeder support (this app only)

- Games → select a **64-bit DX11/DX12 executable** → **Feeder + Overlay** → Install.
  Restore originals before changing routes. Remove an older standalone
  overlay before installing this build. Keep the app open; press **F8** in-game.
- Installs the verified Feeder 0.12.0 payload and supplied RenoDX v4.7, plus the
  overlay beside the actual executable. Main-app files are not modified.
  A failed installation rolls back through the file journal. Newly installed
  overlays join Restore originals; pre-existing standalone overlays do not.
- Feeder controls use its existing `dlss5-feed.cfg` reload, not private memory:
  motion X/Y, HDR and depth; **DX11 only:** work resolution, upscale filter,
  sharpness. Dropdowns stay inside the same shared panel. Unsupported controls
  remain disabled. NR appearance/style continues through the separate RenoDX bridge.
- Feeder reloads every 60 delivered frames while its pipeline is running.
  Values shown are **configuration readback**, not confirmation of a successful
  neural render. Changes can pause when the shader is off or Feeder has failed.
  Feeder's original enable/disable control remains in its original ReShade page:
  disabled Feeder skips cfg reload, so a cfg-only off switch cannot turn it back on.
- Writes preserve unrelated keys and keep the initial cfg as
  `dlss5-feed.cfg.lab-original`. Missing/duplicate/invalid keys and unknown Feeder
  binaries are refused. Existing files are not silently reset.
- The app preview has a **Preview: RenoDX / Feeder + RenoDX** switch. Preview
  changes stay local and never alter game settings.
- Verified in hidden DX11 and DX12 transport-only hosts: UI → native adapter →
  actual Feeder runtime cfg reload, without restarting. This is not a claim
  of neural image quality or compatibility with every game. **32-bit/helper,
  Vulkan/OpenGL automatic installation and OptiScaler are not supported here.**

Pinned Feeder binary: `066eec8c797df2d656f2ab2324278921b1dd6e9116c9945294f4a00f7fec608a`.
[Upstream v0.12.0 configuration implementation](https://github.com/jlrouzies-fr/DLSS5-Feeder/blob/v0.12.0/src/dlss5-feed.cpp).

## RenoDX bridge details

This is **not a supported public RenoDX API**. It is an experimental, version-specific
adapter for the pinned `renodx-dlss5.addon64` v4.7, SHA-256:
`d5adf82eb44b065f4c590ac91fe824bab07afea0eb9f994bde936710c8593952`.
Other builds, missing modules, changed code signatures and unexpected ImGui
tables are refused. Standalone overlay installation does not upgrade RenoDX;
the explicit **Feeder + Overlay** game installation includes the pinned v4.7 build.

The adapter temporarily redirects **RenoDX's private ImGui table pointer** to a
local copy while synchronously invoking its original panel callback, then
restores it. This undocumented mechanism may be incompatible with some games
or other add-ons. No global ReShade table is modified and no NR-state address
is written directly: the original callback performs its own atomic updates and
configuration saves. Original ReShade/RenoDX panels remain registered.

Installing this experimental overlay enables automatic connection while
DLSS 5 Swapper is running. Merely connecting reads settings: it does not enable NR or
change chosen settings. UI changes are persisted by RenoDX itself. Closing the app
stops UI control, without turning NR off or undoing chosen settings.
No NVIDIA SDK download, game-file replacement or automatic binary loading is
performed by the adapter. Use only in an offline test game; **keep backups**.

## Run and build

From the `app` folder, using its own Electron installation:

```powershell
npm start                 # Overlay section; no automatic library scan
npm run overlay:prepare   # Official pinned SDK + checksum-verified portable Zig
npm run overlay:build     # dist/overlay/dlss5-lab-overlay.addon64
npm test
npm run test:ui
```

Use a **closed offline test game** with **ReShade add-on support** installed.
First remove the previous build using **Remove test overlay only**. Reinstall
using **Install test overlay...**, keep the app open, then launch the game and
press **F8**. If you changed ReShade's overlay key or add-on search
directory, use that key and include the executable directory in its add-on
search path. ReShade is not installed by this experiment. Anti-cheat games may
reject add-ons. Native add-ons execute code: use trusted developers only.

With the exact v4.7 already loaded, connection is automatic. **RenoDX live**
confirms it; the status message explains unsupported or missing binaries.

After updating the app source, **close and restart the app** too: an
already-running Electron process keeps the previous bridge code. The native
add-on now negotiates live-control capabilities before sending newer messages;
an old build keeps showing the design instead of repeatedly dropping the pipe.
Restart the app to enable updated input handling and optional live FX controls.

Select the real rendering executable, not a launcher. For Agefield High:
`Project_HighSchool/Binaries/Win64/Project_HighSchool-Win64-Shipping.exe`.
This revision does not move previously installed files or modify game files
automatically. No changes are made to the main Swapper application.

The built-in panel is shared in `renderer/overlay-panel.js` and
`renderer/overlay-lab.css`; native transport lives in `overlay.cpp` and
`src/overlay-bridge.js`. No screenshots of games are captured by the bridge.
To develop your own native overlay, adapt `overlay.cpp`, change its exported `NAME`
and tab title, compile it for the intended architecture, then import with Add.
Imported native add-ons are stored but **never executed in Electron**.
Adding a third-party overlay does not make it controllable through this preview.

The built-in binary is x64 only. x86 custom add-ons can be imported for matching
x86 executables. No universal game, API, or DLSS compatibility is claimed.

The portable compiler uses the MinGW ABI, with a tiny header-free MSVC-ABI
object (`imgui-abi.cpp`) for ImVec2 return values. The SDK version is pinned and
checked at compile time. Always rerun the native smoke test after changing
the add-on. The smoke variant is never installed by the app UI.

## Verified locally

- Unit tests cover bounded frame/input/status/command protocols plus file validation, repeat installs, protected main-app paths,
  architecture mismatches, changed files, duplicate builds, linked storage,
  large executables, bounded header reads and descriptor cleanup.
- The 64 MB size limit applies only to imported add-ons. Game EXEs are checked
  using their DOS/COFF headers (88 bytes), including large Unreal Shipping EXEs.
- Hidden Electron tests: Overlay-only startup, Add, Remove, preview controls,
  escaped custom names, errors, Arabic RTL and narrow layouts.
- ReShade 6.8.0 / DirectX 11 and DirectX 12 / RTX 5070 Ti: ordinary add-on loading in a
  disposable native process. The current captured 534×871 preview surface is
  compared with Chromium at 1:1 scale (1/255 channel tolerance for capture
  rounding). Panel geometry is also compared exactly against the app preview.
  Transparent rounded corners blend with the game's background.
- The local input channel was exercised for model selection and a held slider
  drag from 20% to 80%. Separate DX11/DX12 tests change a real test shader's
  output through the live UI and sample pixels outside the overlay to verify it.
  **No real game or NVIDIA neural-rendering pipeline was tested.** Other APIs,
  HDR/color-space transforms, and different display scaling still require testing.
- A legacy-bridge regression test checks that new status packets are withheld,
  the connection stays stable, and an intentional disconnect reconnects once.
- With explicit user approval, isolated DX11 and DX12 processes loaded the real
  supplied RenoDX v4.7. UI commands exercised all 15 mapped controls, including
  all three NR Styles, Preset, Depth Convention, Upscaling and numeric entry;
  the original callback confirmed values on the following invocation and
  saved them to the test's ReShade.ini without restarting the process.
  **This proves live settings integration, not visual quality or game compatibility.**

`scripts/test-renodx-probe.ps1` and `scripts/test-renodx-bridge.js` execute the
supplied native add-on and are intentionally separate from the normal test suite.
The probe build is never offered by the app installer.

## Sources and licenses

- [Official ReShade SDK](https://github.com/crosire/reshade/tree/v6.8.0/include):
  revision `18deaa52de0c425a78b329e9cb3c497281cd00ec`, BSD-3-Clause OR MIT.
- [Dear ImGui](https://github.com/ocornut/imgui): revision
  `3912b3d9a9c1b3f17431aebafd86d2f40ee6e59c`, MIT.
- [Zig 0.14.1](https://ziglang.org/download/0.14.1/release-notes.html): portable
  Windows compiler; downloaded only by the build script, with official archive SHA-256.
- [NVIDIA DLSS 5 developer integration](https://www.nvidia.com/en-us/geforce/news/dlss-5-3d-guided-neural-rendering/).

Overlay source is MIT licensed; see LICENSE. Third-party licenses accompany
the build. NVIDIA, DLSS and ReShade names remain their respective owners' marks.
