#pragma once
// Which %APPDATA% folder holds the bridge endpoint, the hotkey preferences
// and the pipe name. scripts/build-overlay.ps1 passes it as a bare token
// (-DLAB_OVERLAY_PROFILE=dlss5-swapper) because quotes in a -D flag do not
// survive the shell; the widening happens here instead.
#ifndef LAB_OVERLAY_PROFILE
#define LAB_OVERLAY_PROFILE dlss5-lab
#endif
#define LAB_PROFILE_STR2(x) #x
#define LAB_PROFILE_STR(x) LAB_PROFILE_STR2(x)
#define LAB_PROFILE_WIDE2(x) L##x
#define LAB_PROFILE_WIDE(x) LAB_PROFILE_WIDE2(x)
#define LAB_PROFILE_W LAB_PROFILE_WIDE(LAB_PROFILE_STR(LAB_OVERLAY_PROFILE))

// Reads the same atomically saved preference file as Lab. No game files or
// registry settings are involved; poll remains bounded and never waits for IPC.
namespace lab_hotkey {
inline bool valid(int key){return (key>=48&&key<=90)||(key>=112&&key<=135)||key==32||key==33||key==34||key==35||(key>=37&&key<=40)||key==45||key==46;}
struct binding {
    int key=VK_F8,mods=0; ULONGLONG next=0;
    bool parse(const char *json){
        const char *k=strstr(json,"\"key\":"),*m=strstr(json,"\"mods\":");int nk,nm;
        if(!k||!m||sscanf(k+6,"%d",&nk)!=1||sscanf(m+7,"%d",&nm)!=1||!valid(nk)||nm<0||nm>7)return false;
        key=nk;mods=nm;return true;
    }
    void poll(){
        if(GetTickCount64()<next)return;next=GetTickCount64()+500;
        wchar_t directory[32768]={};
#ifdef LAB_OVERLAY_SMOKE
        DWORD n=GetEnvironmentVariableW(L"DLSS_LAB_SMOKE_PROFILE",directory,32768);
#else
        DWORD n=GetEnvironmentVariableW(L"APPDATA",directory,32768);
#endif
        if(!n||n>=32768)return;
        std::wstring file=directory;
#ifndef LAB_OVERLAY_SMOKE
        file+=L"\\" LAB_PROFILE_W;
#endif
        file+=L"\\overlay-preferences.json";
        HANDLE h=CreateFileW(file.c_str(),GENERIC_READ,FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_SHARE_DELETE,nullptr,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,nullptr);
        if(h==INVALID_HANDLE_VALUE)return;
        char text[1025]={};DWORD size=GetFileSize(h,nullptr),read=0;
        if(size>0&&size<=1024&&ReadFile(h,text,size,&read,nullptr)&&read==size)parse(text);
        CloseHandle(h);
    }
    template<class Runtime>bool pressed(Runtime *r)const{
        return r->is_key_pressed(key)&&r->is_key_down(VK_CONTROL)==bool(mods&1)&&r->is_key_down(VK_MENU)==bool(mods&2)&&r->is_key_down(VK_SHIFT)==bool(mods&4)&&!r->is_key_down(VK_LWIN)&&!r->is_key_down(VK_RWIN);
    }
};
}
