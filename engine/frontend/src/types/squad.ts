export interface SquadMember {
  user_id: string;
  display_name: string;
  is_leader: boolean;
  joined_at: string;
}

export interface Squad {
  id: string;
  code: string;
  sport: number;
  tier: number;
  lat: number;
  lon: number;
  max_distance: number;
  start_time: number;
  end_time: number;
  members: SquadMember[];
  created_at: string;
}

export interface CreateSquadPayload {
  sport: number;
  tier: number;
  lat: number;
  lon: number;
  max_distance: number;
  start_time: number;
  end_time: number;
}

export interface JoinSquadPayload {
  code: string;
}
