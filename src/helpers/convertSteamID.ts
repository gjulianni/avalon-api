export default function convertSteamID(steamID: string): string {

    const accountId = BigInt(steamID) - BigInt('76561197960265728');

    const y = accountId % 2n;
    const z = accountId / 2n;
    const steamIdString = `STEAM_1:${y}:${z}`;

    return steamIdString;
}