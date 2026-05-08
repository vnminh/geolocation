import { UserRole, UserStatus } from "../../../shared/auth/role";

export interface ForgetPassRequest {
  email: string;
}

export interface ForgetPassResponse {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string | null;
  updated_at: string | null;
}