import { UserRole, UserStatus } from "../../../shared/auth/role";

export interface SignupRequest {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

export interface SignupResponse {
  id: number;
  name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string | null;
  updated_at: string | null;
}