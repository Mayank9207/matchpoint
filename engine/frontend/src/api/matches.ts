import { client } from "./client";
import type { FindMatchPayload, Match } from "../types/match";

export async function findMatch(payload: FindMatchPayload): Promise<Match> {
  // TODO: implement (POST /matches/find)
  throw new Error("not implemented");
}

export async function getMatch(matchId: string): Promise<Match> {
  // TODO: implement (GET /matches/:id)
  throw new Error("not implemented");
}

export async function confirmMatch(matchId: string): Promise<Match> {
  // TODO: implement (POST /matches/:id/confirm)
  throw new Error("not implemented");
}
