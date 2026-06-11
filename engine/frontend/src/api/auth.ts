import { client } from "./client";
import type {
  AuthResponse,
  LoginPayload,
  SignupPayload,
  User,
} from "../types/auth";

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  // TODO: implement (POST /auth/signup)
  throw new Error("not implemented");
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  // TODO: implement (POST /auth/login)
  throw new Error("not implemented");
}

export async function me(): Promise<User> {
  // TODO: implement (GET /auth/me)
  throw new Error("not implemented");
}
