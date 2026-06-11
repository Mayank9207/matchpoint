import { client } from "./client";
import type {
  CreateSquadPayload,
  JoinSquadPayload,
  Squad,
} from "../types/squad";

export async function createSquad(payload: CreateSquadPayload): Promise<Squad> {
  // TODO: implement (POST /squads/create)
  throw new Error("not implemented");
}

export async function joinSquad(payload: JoinSquadPayload): Promise<Squad> {
  // TODO: implement (POST /squads/join)
  throw new Error("not implemented");
}

export async function getSquad(squadId: string): Promise<Squad> {
  // TODO: implement (GET /squads/:id)
  throw new Error("not implemented");
}

export async function leaveSquad(squadId: string): Promise<void> {
  // TODO: implement (POST /squads/:id/leave)
  throw new Error("not implemented");
}
