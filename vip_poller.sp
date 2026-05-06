#include <sourcemod>
#include <SteamWorks>

#define ADM_SIMPLE_PATH "configs/admins_simple.ini"

public void OnPluginStart() {
    CreateTimer(30.0, Timer_CheckQueue, _, TIMER_REPEAT);
}

public Action Timer_CheckQueue(Handle timer) {
    Handle hRequest = SteamWorks_CreateHTTPRequest(k_EHTTPMethodGET, "https://avalon-api-px5p.onrender.com/api/store/sync-commands");
    
    if (hRequest != INVALID_HANDLE) {
        SteamWorks_SetHTTPRequestHeaderValue(hRequest, "ngrok-skip-browser-warning", "1");
        SteamWorks_SetHTTPCallbacks(hRequest, OnHTTPComplete);
        SteamWorks_SendHTTPRequest(hRequest);
    }
    
    return Plugin_Continue;
}

public void OnHTTPComplete(Handle hRequest, bool bFailure, bool bRequestSuccessful, EHTTPStatusCode eStatusCode) {
    if (bRequestSuccessful && eStatusCode == k_EHTTPStatusCode200OK) {
        int iSize;
        SteamWorks_GetHTTPResponseBodySize(hRequest, iSize);

        if (iSize > 0) {
            char[] sBody = new char[iSize + 1];
            if (SteamWorks_GetHTTPResponseBodyData(hRequest, sBody, iSize)) {
                sBody[iSize] = '\0';
                TrimString(sBody);
                ReplaceString(sBody, iSize + 1, "\n", ";");
                ReplaceString(sBody, iSize + 1, "\r", "");

                if (strlen(sBody) > 5) {
                    char sCommands[10][192];
                    int count = ExplodeString(sBody, ";", sCommands, sizeof(sCommands), sizeof(sCommands[]));

                    for (int i = 0; i < count; i++) {
                        TrimString(sCommands[i]);
                        if (strlen(sCommands[i]) > 5) {

                            char auth[64];
                            int steamIdx = StrContains(sCommands[i], "STEAM_");

                            if(steamIdx != -1) {
                                int endIdx = steamIdx;
                                while (sCommands[i][endIdx] != '\0' && sCommands[i][endIdx] != ' ' && sCommands[i][endIdx] != '"' && sCommands[i][endIdx] != ';') {
                                    endIdx++;
                                }
                                int len = endIdx - steamIdx;
                                for (int c = 0; c < len; c++) {
                                    auth[c] = sCommands[i][steamIdx + c];
                                }
                                auth[len] = '\0';

                                if (StrContains(sCommands[i], "sm_addvip", false) != -1) {
                                    SincronizarAdicao(auth);
                                }
                                else if (StrContains(sCommands[i], "sm_delvip", false) != -1) {
                                    SincronizarRemocao(auth);
                                }
                            }

                            PrintToServer("[VIP POLLER] EXECUTANDO: %s", sCommands[i]);
                            ServerCommand("%s", sCommands[i]);
                        }
                    }
                    ServerExecute();
                }
            }
        }
    }
    delete hRequest;
}

// ========================================================
// ADMIN_SIMPLE.INI
// ========================================================

void SincronizarAdicao(const char[] auth) {
    char sPath[PLATFORM_MAX_PATH];
    BuildPath(Path_SM, sPath, sizeof(sPath), ADM_SIMPLE_PATH);
    
    char searchStr[64];
    Format(searchStr, sizeof(searchStr), "\"%s\"", auth);

    File hFile = OpenFile(sPath, "r");
    if (hFile != null) {
        char szLine[256];
        while (!hFile.EndOfFile()) {
           if (hFile.ReadLine(szLine, sizeof(szLine)) && StrContains(szLine, searchStr, false) != -1) {
                delete hFile;
                return; 
            }
        }
        delete hFile;
    }

    hFile = OpenFile(sPath, "a");
    if (hFile != null) {
        hFile.WriteLine("\n%s \"a\" // VIP Sincronizado", searchStr);
        delete hFile;
        PrintToServer("[AVALON] Sincronizado: %s adicionado ao admins_simple.", auth);
        ServerCommand("sm_reloadadmins");
    }
}

void SincronizarRemocao(const char[] auth) {
    char sPath[PLATFORM_MAX_PATH];
    BuildPath(Path_SM, sPath, sizeof(sPath), ADM_SIMPLE_PATH);
    if (!FileExists(sPath)) return;

    char searchStr[64];
    Format(searchStr, sizeof(searchStr), "\"%s\"", auth);

    ArrayList hLines = new ArrayList(512);
    bool bFound = false;
    File hFile = OpenFile(sPath, "r");
    if (hFile != null) {
        char szLine[512];
        while (!hFile.EndOfFile()) {
            if (hFile.ReadLine(szLine, sizeof(szLine))) {
                if (StrContains(szLine, searchStr, false) != -1) { 
                    bFound = true; 
                    continue; 
                }
                hLines.PushString(szLine);
            }
        }
        delete hFile;
    }

    if (bFound) {
        hFile = OpenFile(sPath, "w");
        if (hFile != null) {
            char szBuffer[512];
            for (int i = 0; i < hLines.Length; i++) {
                hLines.GetString(i, szBuffer, sizeof(szBuffer));
                hFile.WriteString(szBuffer, false);
            }
            delete hFile;
            PrintToServer("[AVALON] Sincronizado: %s removido do admins_simple.", auth);
            ServerCommand("sm_reloadadmins");
        }
    }
    delete hLines;
}