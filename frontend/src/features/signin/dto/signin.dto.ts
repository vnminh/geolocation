import { UserRole, UserStatus } from "../../../shared/auth/role";

export interface SigninRequest {
  email: string;
  password: string;
}

export interface SigninResponse {
  id: number;
  name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string | null;
  updated_at: string | null;
}