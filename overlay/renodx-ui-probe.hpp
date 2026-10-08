// Lab-only proof: route one known RenoDX build's own UI callback through a
// temporary private copy of its ImGui dispatch table. No global ReShade hooks,
// no writes to NR settings by address, no binary-file modifications.
#pragma once
#include <wincrypt.h>
#include <cstdio>
namespace nr_probe {
// Every RenoDX build this adapter knows how to drive. Knowing the file is not
// enough: the bridge borrows the add-on's own UI dispatch for one call, so it
// also needs the address of the slot holding ReShade's ImGui table, the address
// of the overlay callback to invoke, and two pieces of the add-on's own code to
// recognise before it touches either. All four move with every build, so they
// are pinned per build and re-checked in memory at run time; an unknown build is
// refused and the panel says so rather than guessing at an address.
//
// This is what went stale when the shipped consumer moved from 4.70 to 6.5.3:
// the panel said "unsupported build" and every NR control went dark. The build
// the app ships must appear here, and npm run payload refuses to build if it
// does not.
//
// 6.5.3 registers its page as "DLSS 5 Neural Rendering" where 4.70 called it
// "RenoDX-DLSSNR". The control labels the bridge matches on are unchanged, save
// "Enable Upscaling (WIP)", which 6.x dropped.
struct build_pin {
    const char *name;
    DWORD size;
    const unsigned char *sha256;
    DWORD slot;                                   // imgui_function_table *
    DWORD init_at; const unsigned char *init; DWORD init_size;
    DWORD call_at; const unsigned char *call; DWORD call_size;
    DWORD overlay;                                // void(effect_runtime *)
};
inline const unsigned char sha_653[] = {0x34,0x23,0x41,0xf6,0x69,0xf1,0xd6,0x4e,0x0c,0x70,0xc8,0x59,0x3a,0x07,0xa2,0xfa,0xb5,0x07,0x5e,0x07,0x3d,0xfa,0xe9,0x7c,0x33,0x1c,0x9a,0x67,0x76,0x26,0x0a,0x0a};
inline const unsigned char init_653[] = {0xb9,0x32,0x4b,0x00,0x00,0xff,0xd0,0x48,0x89,0x05,0x74,0x96,0x06,0x00};
inline const unsigned char call_653[] = {0x48,0x8d,0x15,0x33,0x0b,0xfe,0xff,0x48,0x8d,0x0d,0x7c,0x07,0x04,0x00,0xff,0xd0};
inline const unsigned char sha_470[] = {0xd5,0xad,0xf8,0x2e,0xb4,0x4b,0x06,0x5f,0x4c,0x59,0x0a,0xc9,0x1f,0xe8,0x24,0xba,0xb0,0x7a,0xfe,0xa0,0xeb,0x9f,0x99,0x4b,0xde,0x93,0x67,0x10,0xc8,0x59,0x39,0x52};
inline const unsigned char init_470[] = {0xb9,0x32,0x4b,0x00,0x00,0xff,0xd0,0x48,0x89,0x05,0x9a,0x2c,0x17,0x00};
inline const unsigned char call_470[] = {0x48,0x8d,0x15,0x7d,0x45,0x00,0x00,0xff,0xd0};
inline const build_pin known_builds[] = {
    {"6.5.3", 878080,  sha_653, 0xceef8,  0x65876, init_653, sizeof(init_653), 0x59f36, call_653, sizeof(call_653), 0x3aa70},
    {"4.7",   1732608, sha_470, 0x196ca0, 0x23ff8, init_470, sizeof(init_470), 0x2607c, call_470, sizeof(call_470), 0x2a600}
};
inline bool hash_matches(HMODULE module, DWORD required_size = 1732608, const unsigned char *required_hash = nullptr) {
    wchar_t filename[32768];
    if (!GetModuleFileNameW(module, filename, 32768)) return false;
    HANDLE file = CreateFileW(filename, GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, 0, nullptr);
    if (file == INVALID_HANDLE_VALUE) return false;
    const DWORD size = GetFileSize(file, nullptr);
    std::vector<unsigned char> data(size == required_size ? size : 0); DWORD read = 0;
    const bool ok = !data.empty() && ReadFile(file, data.data(), size, &read, nullptr) && read == size;
    CloseHandle(file); if (!ok) return false;
    HCRYPTPROV provider = 0; HCRYPTHASH hash = 0; BYTE digest[32]; DWORD length = 32;
    bool matches = false;
    if (CryptAcquireContextW(&provider, nullptr, nullptr, PROV_RSA_AES, CRYPT_VERIFYCONTEXT) &&
        CryptCreateHash(provider, CALG_SHA_256, 0, 0, &hash) &&
        CryptHashData(hash, data.data(), size, 0) && CryptGetHashParam(hash, HP_HASHVAL, digest, &length, 0)) {
        matches = length == 32 && memcmp(digest, required_hash ? required_hash : sha_470, 32) == 0;
    }
    if (hash) CryptDestroyHash(hash); if (provider) CryptReleaseContext(provider, 0);
    return matches;
}
// Which of the known builds is loaded, if any. The size rules out every other
// build before a byte of the file is hashed.
inline const build_pin *identify(HMODULE module) {
    for (const auto &pin : known_builds) if (hash_matches(module, pin.size, pin.sha256)) return &pin;
    return nullptr;
}
inline const imgui_function_table *original = nullptr;
inline unsigned frame = 0;
inline bool applied = false, verified = false;
inline bool slider(const char *label, float *value, float lo, float hi, const char *format, ImGuiSliderFlags flags) {
    if (frame == 1) {
        char msg[256]; snprintf(msg, sizeof(msg), "NR_PROBE_CONTROL %s = %.3f range %.3f..%.3f", label, *value, lo, hi);
        reshade::log::message(reshade::log::level::info, msg);
    }
    if (strcmp(label, "Structure Intensity") == 0) {
        if (frame == 10 && lo <= .43f && hi >= .43f) { *value = .43f; applied = true; return true; }
        if (frame == 11 && applied && std::abs(*value - .43f) < .00001f) {
            verified = true; reshade::log::message(reshade::log::level::info, "NR_PROBE_ORIGINAL_CALLBACK_READBACK_OK Structure Intensity=0.43");
        }
    }
    return original->SliderFloat(label, value, lo, hi, format, flags);
}
inline void tick(reshade::api::effect_runtime *runtime) {
    if (frame >= 12) return;
    HMODULE module = GetModuleHandleW(L"renodx-dlss5.addon64"); if (!module) return;
    static bool checked = false;
    static const build_pin *build = nullptr;
    if (!checked) { build = identify(module); checked = true; }
    if (!build) return;
    auto base = reinterpret_cast<unsigned char *>(module);
    // Static provenance, per build: GetImGuiFunctionTable(19250) stores its
    // result in build->slot, and the add-on registers build->overlay as the
    // callback that draws its page.
    auto slot = reinterpret_cast<const imgui_function_table **>(base + build->slot);
    original = imgui_function_table_instance();
    if (*slot != original) return; // Never chain unknown replacements.
    imgui_function_table table = *original; table.SliderFloat = slider;
    ++frame;
    ImGui::SetNextWindowPos(ImVec2(-30000, -30000));
    ImGui::SetNextWindowSize(ImVec2(600, 1000));
    ImGui::Begin("##NRLabProbe", nullptr, ImGuiWindowFlags_NoInputs | ImGuiWindowFlags_NoSavedSettings | ImGuiWindowFlags_NoBackground);
    *slot = &table;
    reinterpret_cast<void (*)(reshade::api::effect_runtime *)>(base + build->overlay)(runtime);
    *slot = original;
    ImGui::End();
}
}
