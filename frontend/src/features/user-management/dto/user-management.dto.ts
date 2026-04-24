import { UserRole, UserStatus } from "../../../shared/auth/role";
import { PaginatedData } from "../../../shared/types/pagination";

export interface UserManagementRow {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string | null;
  updated_at: string | null;
}

export type UserListEnvelopeData = PaginatedData<UserManagementRow>;

export interface UserRolePatchPayload {
  id: number;
  role: UserRole;
}

export interface UserStatusPatchPayload {
  id: number;
  status: UserStatus;
}

export interface CreateUserPayload {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}
