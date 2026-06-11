export interface Room {
  id: string;
  sport: number;
  desired_tier: number;
  lat: number;
  lon: number;
  capacity: number;
  match_time: number;
}

export interface Match {
  match_id: string;
  squad_id: string;
  room: Room | null;
  distance_m: number | null;
  cost: number | null;
  confirmed: boolean;
}

export interface FindMatchPayload {
  squad_id: string;
  w_dist?: number;
  w_tier?: number;
  max_iter?: number;
}
