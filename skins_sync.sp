#include <sourcemod>
#include <sdktools>
#include <cstrike>
#include <ripext>

#define API_BASE_URL "https://avalon-api-px5p.onrender.com"
#define API_PATH "api/skins/sync"

Database g_dbSkins;
HTTPClient g_httpClient;

public Plugin myinfo = 
{
	name = "AVALON Skin Sync",
	author = "nanno",
	description = "Sincronização de skins via Web API",
	version = "1.0.0"
};

native void Weapons_ReloadPlayerData(int client);

public void OnPluginStart() {
    char error[256];
    g_dbSkins = SQLite_UseDatabase("sourcemod-local", error, sizeof(error));
    if (g_dbSkins == null) SetFailState("[Avalon] Erro critico ao abrir SQLite: %s", error);

    g_httpClient = new HTTPClient(API_BASE_URL);
    g_httpClient.SetHeader("ngrok-skip-browser-warning", "true");
    RegConsoleCmd("sm_sync", Command_Sync);
}

public Action Command_Sync(int client, int args) {
    if (client == 0 || !IsClientInGame(client)) return Plugin_Handled;
    char steamId[64];
    if (!GetClientAuthId(client, AuthId_Steam2, steamId, sizeof(steamId))) {
        PrintToChat(client, " \x0B[AVALON]\x01 Erro ao obter seu SteamID.");
        return Plugin_Handled;
    }

    PrintToChat(client, " \x0B[AVALON]\x01 Sincronizando suas skins...");

    char url[256];
    Format(url, sizeof(url), "%s/%s", API_PATH, steamId);
    g_httpClient.Get(url, OnSyncResponse, GetClientUserId(client));

    return Plugin_Handled;
}

public void OnSyncResponse(HTTPResponse response, any userid) {
    int client = GetClientOfUserId(userid);
    if (client == 0 || !IsClientInGame(client)) return;

    if (response.Status != HTTPStatus_OK) {
        PrintToChat(client, " \x0B[AVALON]\x01 Falha ao contatar a API. Tente novamente.");
        return;
    }

    JSONObject jsonResponse = view_as<JSONObject>(response.Data);
    if (jsonResponse == null || !jsonResponse.GetBool("success")) {
        PrintToChat(client, " \x0B[AVALON]\x01 Nenhuma skin encontrada no banco de dados.");
        return;
    }

    JSONArray skins = view_as<JSONArray>(jsonResponse.Get("skins"));
    if (skins == null) return;

    for (int i = 0; i < skins.Length; i++) {
        JSONObject s = view_as<JSONObject>(skins.Get(i));
        char steamId[64], weapon[64], query[512], accountId[32];
        
        s.GetString("steamId", steamId, sizeof(steamId));
        s.GetString("weaponName", weapon, sizeof(weapon));
        strcopy(accountId, sizeof(accountId), steamId[10]);

        Format(query, sizeof(query), "UPDATE ws_weapons SET %s = %d, %s_float = %.2f, %s_seed = %d WHERE steamid LIKE '%%%s'", 
            weapon, s.GetInt("paintKit"), weapon, s.GetFloat("wearFloat"), weapon, s.GetInt("seed"), accountId);
        if (!SQL_FastQuery(g_dbSkins, query)) {
            PrintToServer("[Skins Sync] Erro ao atualizar skin da arma %s", weapon);
        }
        
        int modelId = s.GetInt("knifeModelId");
        if (modelId > 0) {
            Format(query, sizeof(query), "UPDATE ws_weapons SET knife = %d WHERE steamid LIKE '%%%s'", modelId, accountId);
            SQL_FastQuery(g_dbSkins, query);
        }

        delete s;
    }
    delete skins;
    
    Weapons_ReloadPlayerData(client);
    CreateTimer(0.6, Timer_RefreshReal, userid);
    
    PrintToChat(client, " \x0B[AVALON]\x01 Sincronização concluída com sucesso!");
}

public Action Timer_RefreshReal(Handle timer, any userid) {
    int client = GetClientOfUserId(userid);
    
    if (client > 0 && IsClientInGame(client) && IsPlayerAlive(client)) {
        for (int slot = 0; slot < 3; slot++) { 
            int weapon = GetPlayerWeaponSlot(client, slot);
            if (weapon > 0 && IsValidEntity(weapon)) {
                char classname[64];
                GetEntityClassname(weapon, classname, sizeof(classname));

                if (slot == 2) {
                    RemovePlayerItem(client, weapon);
                    AcceptEntityInput(weapon, "Kill");
                    
                    DataPack pack;
                    CreateDataTimer(0.3, Timer_GiveKnifeBack, pack);
                    pack.WriteCell(GetClientUserId(client));
                } else {
                    int ammo = GetEntProp(weapon, Prop_Send, "m_iPrimaryReserveAmmoCount");
                    int clip = GetEntProp(weapon, Prop_Send, "m_iClip1");

                    RemovePlayerItem(client, weapon);
                    AcceptEntityInput(weapon, "Kill");
                    
                    int newWep = GivePlayerItem(client, classname);
                    if (newWep > 0) {
                        SetEntProp(newWep, Prop_Send, "m_iClip1", clip);
                        SetEntProp(newWep, Prop_Send, "m_iPrimaryReserveAmmoCount", ammo);
                    }
                }
            }
        }
    }
    return Plugin_Stop;
}

public Action Timer_GiveKnifeBack(Handle timer, DataPack pack) {
    pack.Reset();
    int client = GetClientOfUserId(pack.ReadCell());
    if (client > 0 && IsClientInGame(client)) {
        GivePlayerItem(client, "weapon_knife"); 
    }
    return Plugin_Stop;
}