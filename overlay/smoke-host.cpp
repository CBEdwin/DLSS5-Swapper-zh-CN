// Standalone, hidden DX11 test. Never attaches to or launches a game.
#include <Windows.h>
#include <d3d11.h>
#include <cstdio>
#include <vector>

LRESULT CALLBACK window_proc(HWND w, UINT m, WPARAM a, LPARAM b) { return DefWindowProcW(w, m, a, b); }
bool screenshot(ID3D11Device *device, ID3D11DeviceContext *context, ID3D11Texture2D *back) {
    D3D11_TEXTURE2D_DESC desc; back->GetDesc(&desc);
    desc.Usage = D3D11_USAGE_STAGING; desc.BindFlags = 0; desc.CPUAccessFlags = D3D11_CPU_ACCESS_READ; desc.MiscFlags = 0;
    ID3D11Texture2D *staging = nullptr;
    if (FAILED(device->CreateTexture2D(&desc, nullptr, &staging))) return false;
    context->CopyResource(staging, back);
    D3D11_MAPPED_SUBRESOURCE map;
    if (FAILED(context->Map(staging, 0, D3D11_MAP_READ, 0, &map))) { staging->Release(); return false; }
    std::vector<unsigned char> pixels(desc.Width * desc.Height * 4);
    for (UINT y = 0; y < desc.Height; ++y) {
        auto source = static_cast<unsigned char *>(map.pData) + y * map.RowPitch;
        auto target = pixels.data() + y * desc.Width * 4;
        for (UINT x = 0; x < desc.Width; ++x) { target[x*4] = source[x*4+2]; target[x*4+1] = source[x*4+1]; target[x*4+2] = source[x*4]; target[x*4+3] = 255; }
    }
    context->Unmap(staging, 0); staging->Release();
    BITMAPFILEHEADER file = {}; file.bfType = 0x4d42; file.bfOffBits = sizeof(file) + sizeof(BITMAPINFOHEADER); file.bfSize = file.bfOffBits + pixels.size();
    BITMAPINFOHEADER info = {}; info.biSize = sizeof(info); info.biWidth = desc.Width; info.biHeight = -static_cast<LONG>(desc.Height); info.biPlanes = 1; info.biBitCount = 32;
    FILE *out = fopen("native-overlay.bmp", "wb"); if (!out) return false;
    bool ok = fwrite(&file, sizeof(file), 1, out) == 1 && fwrite(&info, sizeof(info), 1, out) == 1 && fwrite(pixels.data(), pixels.size(), 1, out) == 1;
    fclose(out); return ok;
}

int main() {
    SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
    WNDCLASSW cls = {}; cls.lpfnWndProc = window_proc; cls.hInstance = GetModuleHandleW(nullptr); cls.lpszClassName = L"DLSSLabSmoke";
    RegisterClassW(&cls);
    HWND window = CreateWindowW(cls.lpszClassName, L"DLSS Lab isolated DX11 test", WS_OVERLAPPEDWINDOW, 0, 0, 850, 1240, nullptr, nullptr, cls.hInstance, nullptr);
    // Load ReShade before creating this test process's device. Its ordinary
    // add-on loader and present hook must load/draw the overlay themselves.
    // This affects only this disposable process, not another game or registry.
    HMODULE reshade = LoadLibraryExW(L"ReShade64.dll", nullptr, LOAD_WITH_ALTERED_SEARCH_PATH);
    if (!reshade) { printf("ReShade load failed: %lu\n", GetLastError()); return 2; }
    DXGI_SWAP_CHAIN_DESC desc = {}; desc.BufferDesc.Width = 800; desc.BufferDesc.Height = 1200; desc.BufferDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
    desc.SampleDesc.Count = 1; desc.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT; desc.BufferCount = 1; desc.OutputWindow = window; desc.Windowed = TRUE; desc.SwapEffect = DXGI_SWAP_EFFECT_DISCARD;
    ID3D11Device *device = nullptr; ID3D11DeviceContext *context = nullptr; IDXGISwapChain *chain = nullptr;
    if (FAILED(D3D11CreateDeviceAndSwapChain(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, 0, nullptr, 0, D3D11_SDK_VERSION, &desc, &chain, &device, nullptr, &context))) { puts("DX11 hardware device creation failed"); return 1; }
    ID3D11Texture2D *back = nullptr; ID3D11RenderTargetView *rtv = nullptr;
    if (FAILED(chain->GetBuffer(0, __uuidof(ID3D11Texture2D), reinterpret_cast<void **>(&back))) || FAILED(device->CreateRenderTargetView(back, nullptr, &rtv))) return 4;
    bool captured = false;
    char live[2]; const int frames = GetEnvironmentVariableA("DLSS_LAB_SMOKE_LIVE", live, 2) ? 700 : 120;
    for (int frame = 0; frame < frames; ++frame) {
        MSG message; while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) { TranslateMessage(&message); DispatchMessageW(&message); }
        const float color[] = {.055f, .075f, .085f, 1.f};
        context->OMSetRenderTargets(1, &rtv, nullptr); context->ClearRenderTargetView(rtv, color);
        chain->Present(0, 0);
        if (frame == frames - 1) captured = screenshot(device, context, back);
        Sleep(10);
    }
    rtv->Release(); back->Release(); chain->Release(); context->Release(); device->Release(); DestroyWindow(window);
    puts(captured ? "LAB_NATIVE_CAPTURE_OK" : "LAB_NATIVE_CAPTURE_FAILED");
    return captured ? 0 : 5;
}
