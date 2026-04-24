export type UserRole = "user" | "admin";
export type UserStatus = "active" | "block";

export interface SessionUser {
  id: number;
  name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string | null;
  updated_at: string | null;
}