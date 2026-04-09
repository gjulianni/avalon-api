export interface ServerCache {
  serverInfo: FilteredServerInfo | null;
  thumbnailUrl: string | null;
  lastUpdated: string | null;
}

export interface FilteredServerInfo {
  name: string;
  map: string;
  players: number;
  maxPlayers: number;
  playerList: PlayerInfo[];
  ip: string;
  port: string;
}

export interface PlayerInfo {
  name: string;
  score: number;
  duration: number;
}

export interface SteamUser {
  id: string;
  displayName: string;
  photos: { value: string }[];
}

export interface CheckoutRequestBody {
  packageId: number;
  quantity: number;
  email: string;
  coupon?: string;
  gateway: 'PIX' | 'MERCADOPAGO' | 'STRIPE' | 'PAYPAL' | 'PICPAY' | 'PAGSEGURO' | 'PAGARME' | 'OTHER';
}
