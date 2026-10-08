# DLSS 5 Swapper v2.1.1

This release adds a complete DLSS5-Feeder path for games without native DLSS,
introduces emulator support, makes full-drive scanning optional, and fixes
several executable, rendering API and recovery issues reported by users.

## New: DLSS5-Feeder for 64-bit games

- Games without a native `nvngx_dlss.dll` now default to the Feeder route.
- Choose Native DLSS or DLSS5-Feeder from the game details screen.
- Supports DirectX 11, DirectX 12, Vulkan and OpenGL targets.
- Uses LumeniteFX Kernel 2.0 motion vectors when available, with bundled VORT
  as an offline fallback.
- Keeps the upstream-compatible RenoDX DLSS5 host paired with Feeder.

## Emulator support

Added profiles for DuckStation, PCSX2, Dolphin, PPSSPP, Xenia, Cemu, RPCS3,
Ryujinx, yuzu-family emulators, shadPS4, Citra-family emulators, melonDS,
Flycast, xemu, Vita3K, RetroArch, mGBA, Snes9x and Play!.

Supported emulators expose their Direct3D, Vulkan and OpenGL renderer choices.
Vulkan installs use a per-user ReShade layer that remains registered until the
last Vulkan target installed by the app is restored.

## Scanning and library improvements

- Full fixed-drive scanning is off by default and can be enabled with a new
  Settings toggle.
- Enabling it scans all fixed drives; disabling it does not affect Steam, Epic
  Games, GOG, or folders and games explicitly added by the user.
- Automatically discovered and user-added scan roots remain removable.
- `reshade-shaders`, `_DLSS5_Backup` and unrelated folders without a game or
  emulator executable are no longer displayed as games.

## Fixes

- DuckStation's current `duckstation-qt-x64-ReleaseLTCG.exe` is recognised.
- Invalid ReShade search paths such as `Shaders\**\**` are repaired to make
  installed Feeder and motion-vector effects visible.
- Red Dead Redemption 2 now selects `RDR2.exe`, ignores the Rockstar launcher
  in `Redistributables`, and exposes DirectX 12 and Vulkan instead of falsely
  reporting DirectX 9.
- Old cached scanner results are invalidated when detection rules change.
- A recovery manifest is saved before ReShade Setup runs. A partial or failed
  setup can therefore be cleaned with Restore originals immediately.
- Existing proxy files are restored instead of deleted after a failed setup.
- The redundant optional DX12/DX11/DX9 companion was removed. The integrated
  RenoDX and Feeder routes remain, and custom Add-ons are still supported.

## Existing 2.1.x compatibility

Includes support for 32-bit DX9/DX10/DX11 games, Xbox Game Pass flat-file
installs, deep Unreal layouts, nested DLSS DLL detection and stable restoration
after repeated installs. Reported titles handled include Resident Evil 5,
Fallout: New Vegas, Far Cry 3, Deus Ex: Human Revolution, Batman: Arkham
Asylum/Origins, Dishonored, Assassin's Creed IV: Black Flag, Dying Light: The
Beast, NTE: Neverness to Everness and Red Dead Redemption 2.

> The binaries are not code-signed. Windows SmartScreen may require
> **More info → Run anyway** on first launch.

## SHA-256

- `DLSS5-Swapper-Setup-2.1.1.exe`  
  `EFFAA349DECE6546712BC6FF3E5D63A6D59E31D407ABF7363560A4537B7CFA89`
- `DLSS5-Swapper-2.1.1-portable.exe`  
  `E90AB7BBC7F63A18738548EBA4262A0A9D64A7865213D8319CA9D0E138595E67`
