#include <sourcemod>
#include <sdktools>
#include <cstrike>
#include <ripext>

#define API_BASE_URL "https://api.com"
#define API_PATH "api/skins/sync"

Database g_dbSkins;
HTTPClient g_httpClient;

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
    if (client == 0) return Plugin_Handled;
    PrintToChat(client, " \x0B[AVALON]\x01 Sincronizando... Verifique o console do server se falhar.");
    IniciarSincronizacao();
    return Plugin_Handled;
}

void IniciarSincronizacao() {
    JSONArray steamIdsArray = new JSONArray();
    for (int i = 1; i <= MaxClients; i++) {
        if (IsClientInGame(i) && !IsFakeClient(i)) {
            char steamId[64];
            GetClientAuthId(i, AuthId_Steam2, steamId, sizeof(steamId));
            steamIdsArray.PushString(steamId);
        }
    }
    
    JSONObject payload = new JSONObject();
    payload.Set("steamIds", steamIdsArray);
    g_httpClient.Post(API_PATH, payload, OnSyncResponse);
    
    delete payload;
    delete steamIdsArray;
}

public void OnSyncResponse(HTTPResponse response, any value) {
    if (response.Status != HTTPStatus_OK) {
        PrintToServer("[Avalon-Erro] API respondeu com Status %d.", response.Status);
        return;
    }

    JSONObject jsonResponse = view_as<JSONObject>(response.Data);
    if (jsonResponse == null || !jsonResponse.GetBool("success")) {
        PrintToServer("[Avalon-Erro] JSON invalido ou success = false");
        return;
    }

    JSONArray skins = view_as<JSONArray>(jsonResponse.Get("skins"));
    if (skins == null) return;

    PrintToServer("[Avalon] Processando %d skins recebidas...", skins.Length);

    for (int i = 0; i < skins.Length; i++) {
        JSONObject s = view_as<JSONObject>(skins.Get(i));
        char steamId[64], weapon[64], query[512], accountId[32];
        
        s.GetString("steamId", steamId, sizeof(steamId));
        s.GetString("weaponName", weapon, sizeof(weapon));
        strcopy(accountId, sizeof(accountId), steamId[10]);

   
        Format(query, sizeof(query), "UPDATE ws_weapons SET %s = %d, %s_float = %.2f, %s_seed = %d WHERE steamid LIKE '%%%s'", 
            weapon, s.GetInt("paintKit"), weapon, s.GetFloat("wearFloat"), weapon, s.GetInt("seed"), accountId);
        g_dbSkins.Query(SQL_ConfirmarUpdate, query);
        
    
        int modelId = s.GetInt("knifeModelId");
        if (modelId > 0) {
            Format(query, sizeof(query), "UPDATE ws_weapons SET knife = %d WHERE steamid LIKE '%%%s'", modelId, accountId);
            g_dbSkins.Query(SQL_ConfirmarUpdate, query);
        }

        delete s;
    }
    delete skins;
    
    CreateTimer(0.2, Timer_TriggerReload, _);
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
            // Remove e "mata" a faca atual de vez
            RemovePlayerItem(client, weapon);
            AcceptEntityInput(weapon, "Kill");
            
            // Pequeno delay apenas para a faca, para garantir que o slot limpou
            DataPack pack;
            CreateDataTimer(0.3, Timer_GiveKnifeBack, pack);
            pack.WriteCell(GetClientUserId(client));
        } else {
            // Refresh normal para AK e Pistolas
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

public Action Timer_TriggerReload(Handle timer) {
    for (int i = 1; i <= MaxClients; i++) {
        if (IsClientInGame(i) && !IsFakeClient(i)) {
            Weapons_ReloadPlayerData(i); 
            
            CreateTimer(0.6, Timer_RefreshReal, GetClientUserId(i));
        }
    }
    return Plugin_Stop;
}

public void SQL_ConfirmarUpdate(Database db, DBResultSet results, const char[] error, any data) {
    if (error[0] != '\0') {
        PrintToServer("[Avalon-SQL-Erro] %s", error);
    } else {
        PrintToServer("[Avalon-SQL] Banco atualizado com sucesso (Linhas afetadas: %d)", results.AffectedRows);
    }
}