// Hidden, disposable DX12/ReShade verification. Never attaches to a game.
#include <Windows.h>
#include <d3d12.h>
#include <dxgi1_4.h>
#include <vector>
#include <cstdio>
LRESULT CALLBACK window_proc(HWND w, UINT m, WPARAM a, LPARAM b) { return DefWindowProcW(w, m, a, b); }
template<class T> void release(T *p) { if (p) p->Release(); }
#define CHECK(call) if (FAILED(call)) { printf("DX12 failure at line %d\n", __LINE__); return 2; }
int main() {
    SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
    WNDCLASSW cls = {}; cls.lpfnWndProc = window_proc; cls.hInstance = GetModuleHandleW(nullptr); cls.lpszClassName = L"DLSSLabSmoke12"; RegisterClassW(&cls);
    HWND window = CreateWindowW(cls.lpszClassName, L"Lab isolated DX12", WS_OVERLAPPEDWINDOW, 0, 0, 850, 1240, nullptr, nullptr, cls.hInstance, nullptr);
    if (!LoadLibraryExW(L"ReShade64.dll", nullptr, LOAD_WITH_ALTERED_SEARCH_PATH)) return 3;
    ID3D12Device *device = nullptr; CHECK(D3D12CreateDevice(nullptr, D3D_FEATURE_LEVEL_11_0, __uuidof(ID3D12Device), reinterpret_cast<void **>(&device)));
    ID3D12CommandQueue *queue = nullptr; D3D12_COMMAND_QUEUE_DESC q = {}; q.Type = D3D12_COMMAND_LIST_TYPE_DIRECT;
    CHECK(device->CreateCommandQueue(&q, __uuidof(ID3D12CommandQueue), reinterpret_cast<void **>(&queue)));
    IDXGIFactory4 *factory = nullptr; CHECK(CreateDXGIFactory1(__uuidof(IDXGIFactory4), reinterpret_cast<void **>(&factory)));
    DXGI_SWAP_CHAIN_DESC1 desc = {}; desc.Width = 800; desc.Height = 1200; desc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
    desc.SampleDesc.Count = 1; desc.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT; desc.BufferCount = 2; desc.SwapEffect = DXGI_SWAP_EFFECT_FLIP_DISCARD;
    IDXGISwapChain1 *base = nullptr; CHECK(factory->CreateSwapChainForHwnd(queue, window, &desc, nullptr, nullptr, &base));
    IDXGISwapChain3 *chain = nullptr; CHECK(base->QueryInterface(__uuidof(IDXGISwapChain3), reinterpret_cast<void **>(&chain))); base->Release(); factory->Release();
    ID3D12DescriptorHeap *heap = nullptr; D3D12_DESCRIPTOR_HEAP_DESC hd = {}; hd.NumDescriptors = 2; hd.Type = D3D12_DESCRIPTOR_HEAP_TYPE_RTV;
    CHECK(device->CreateDescriptorHeap(&hd, __uuidof(ID3D12DescriptorHeap), reinterpret_cast<void **>(&heap)));
    ID3D12Resource *backs[2] = {}; auto start = heap->GetCPUDescriptorHandleForHeapStart(); auto step = device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_RTV);
    for (unsigned i = 0; i < 2; i++) { CHECK(chain->GetBuffer(i, __uuidof(ID3D12Resource), reinterpret_cast<void **>(&backs[i]))); device->CreateRenderTargetView(backs[i], nullptr, { start.ptr + step * i }); }
    ID3D12CommandAllocator *allocator = nullptr; CHECK(device->CreateCommandAllocator(D3D12_COMMAND_LIST_TYPE_DIRECT, __uuidof(ID3D12CommandAllocator), reinterpret_cast<void **>(&allocator)));
    ID3D12GraphicsCommandList *list = nullptr; CHECK(device->CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, allocator, nullptr, __uuidof(ID3D12GraphicsCommandList), reinterpret_cast<void **>(&list))); list->Close();
    ID3D12Fence *fence = nullptr; CHECK(device->CreateFence(0, D3D12_FENCE_FLAG_NONE, __uuidof(ID3D12Fence), reinterpret_cast<void **>(&fence)));
    HANDLE event = CreateEventW(nullptr, FALSE, FALSE, nullptr); UINT64 value = 0;
    auto wait = [&]() { queue->Signal(fence, ++value); fence->SetEventOnCompletion(value, event); return WaitForSingleObject(event, 10000) == WAIT_OBJECT_0; };
    auto transition = [&](ID3D12Resource *r, D3D12_RESOURCE_STATES before, D3D12_RESOURCE_STATES after) { D3D12_RESOURCE_BARRIER b = {}; b.Type = D3D12_RESOURCE_BARRIER_TYPE_TRANSITION; b.Transition = {r, D3D12_RESOURCE_BARRIER_ALL_SUBRESOURCES, before, after}; list->ResourceBarrier(1, &b); };
    UINT last = 0;
    char live[2]; const int frames = GetEnvironmentVariableA("DLSS_LAB_SMOKE_LIVE", live, 2) ? 700 : 120;
    for (int frame = 0; frame < frames; ++frame) {
        MSG message; while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) { TranslateMessage(&message); DispatchMessageW(&message); }
        CHECK(allocator->Reset()); CHECK(list->Reset(allocator, nullptr)); last = chain->GetCurrentBackBufferIndex();
        transition(backs[last], D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_RENDER_TARGET);
        const float color[] = {.055f, .075f, .085f, 1.f}; D3D12_CPU_DESCRIPTOR_HANDLE rtv = {start.ptr + step * last};
        list->OMSetRenderTargets(1, &rtv, FALSE, nullptr); list->ClearRenderTargetView(rtv, color, 0, nullptr);
        transition(backs[last], D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PRESENT); CHECK(list->Close());
        ID3D12CommandList *commands[] = {list}; queue->ExecuteCommandLists(1, commands); CHECK(chain->Present(0, 0)); if (!wait()) return 4; Sleep(10);
    }
    D3D12_PLACED_SUBRESOURCE_FOOTPRINT footprint = {}; UINT64 bytes = 0; auto rd = backs[last]->GetDesc();
    device->GetCopyableFootprints(&rd, 0, 1, 0, &footprint, nullptr, nullptr, &bytes);
    D3D12_HEAP_PROPERTIES hp = {}; hp.Type = D3D12_HEAP_TYPE_READBACK;
    D3D12_RESOURCE_DESC bd = {}; bd.Dimension = D3D12_RESOURCE_DIMENSION_BUFFER; bd.Width = bytes; bd.Height = 1; bd.DepthOrArraySize = 1; bd.MipLevels = 1; bd.SampleDesc.Count = 1; bd.Layout = D3D12_TEXTURE_LAYOUT_ROW_MAJOR;
    ID3D12Resource *readback = nullptr; CHECK(device->CreateCommittedResource(&hp, D3D12_HEAP_FLAG_NONE, &bd, D3D12_RESOURCE_STATE_COPY_DEST, nullptr, __uuidof(ID3D12Resource), reinterpret_cast<void **>(&readback)));
    CHECK(allocator->Reset()); CHECK(list->Reset(allocator, nullptr));
    transition(backs[last], D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_COPY_SOURCE);
    D3D12_TEXTURE_COPY_LOCATION source = {}, target = {}; source.pResource = backs[last]; source.Type = D3D12_TEXTURE_COPY_TYPE_SUBRESOURCE_INDEX;
    target.pResource = readback; target.Type = D3D12_TEXTURE_COPY_TYPE_PLACED_FOOTPRINT; target.PlacedFootprint = footprint;
    list->CopyTextureRegion(&target, 0, 0, 0, &source, nullptr);
    transition(backs[last], D3D12_RESOURCE_STATE_COPY_SOURCE, D3D12_RESOURCE_STATE_PRESENT); CHECK(list->Close());
    ID3D12CommandList *commands[] = {list}; queue->ExecuteCommandLists(1, commands); if (!wait()) return 4;
    void *mapped = nullptr; D3D12_RANGE range = {0, static_cast<SIZE_T>(bytes)}; CHECK(readback->Map(0, &range, &mapped));
    std::vector<unsigned char> pixels(800 * 1200 * 4);
    for (unsigned y = 0; y < 1200; ++y) for (unsigned x = 0; x < 800; ++x) {
        auto s = static_cast<unsigned char *>(mapped) + footprint.Offset + y * footprint.Footprint.RowPitch + x * 4;
        auto t = pixels.data() + (y * 800 + x) * 4; t[0] = s[2]; t[1] = s[1]; t[2] = s[0]; t[3] = 255;
    }
    D3D12_RANGE written = {}; readback->Unmap(0, &written);
    BITMAPFILEHEADER fh = {}; fh.bfType = 0x4d42; fh.bfOffBits = sizeof(fh) + sizeof(BITMAPINFOHEADER); fh.bfSize = fh.bfOffBits + pixels.size();
    BITMAPINFOHEADER info = {}; info.biSize = sizeof(info); info.biWidth = 800; info.biHeight = -1200; info.biPlanes = 1; info.biBitCount = 32;
    FILE *output = fopen("native-overlay.bmp", "wb"); if (!output) return 5;
    bool ok = fwrite(&fh, sizeof(fh), 1, output) == 1 && fwrite(&info, sizeof(info), 1, output) == 1 && fwrite(pixels.data(), pixels.size(), 1, output) == 1; fclose(output);
    release(readback); release(list); release(allocator); release(heap); release(backs[0]); release(backs[1]); release(chain); release(fence); CloseHandle(event); release(queue); release(device); DestroyWindow(window);
    puts(ok ? "LAB_NATIVE_DX12_CAPTURE_OK" : "LAB_NATIVE_DX12_CAPTURE_FAILED"); return ok ? 0 : 6;
}
