#include <sourcemod>
#include <SteamWorks>

public void OnPluginStart() {
    CreateTimer(30.0, Timer_CheckQueue, _, TIMER_REPEAT);
}

public Action Timer_CheckQueue(Handle timer) {
    Handle hRequest = SteamWorks_CreateHTTPRequest(k_EHTTPMethodGET, "https://api.url/api/store/sync-commands");
    
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
                ReplaceString(sBody, iSize + 1, "\n", "");
                ReplaceString(sBody, iSize + 1, "\r", "");

                if (strlen(sBody) > 5) {
                    char sCommands[10][192];
                    int count = ExplodeString(sBody, ";", sCommands, sizeof(sCommands), sizeof(sCommands[]));

                    for (int i = 0; i < count; i++) {
                        TrimString(sCommands[i]);
                        if (strlen(sCommands[i]) > 5) {
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