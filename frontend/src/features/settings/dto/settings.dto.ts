import { UserRole, UserStatus } from "../../../shared/auth/role";

export interface ProfilePatchRequest {
  id: number;
  password?: string;
  name?: string;
  role?: UserRole;
}

export interface ProfileResponse {
  id: number;
  name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string | null;
  updated_at: string | null;
}

export interface ResetPasswordRequest {
  id: number;
}

export type ResetPasswordResponse = ProfileResponse;