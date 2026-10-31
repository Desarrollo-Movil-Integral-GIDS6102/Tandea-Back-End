import { AuthUserEntity } from '../../entities/auth-user.entity';

export const AUTH_USER_REPOSITORY_PORT = Symbol('AUTH_USER_REPOSITORY_PORT');

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
  lastName: string;
  age?: number | null;
  gender?: string | null;
  idRole: number;
}

export interface AuthRoleData {
  idRole: number;
  nameRole: string;
}

export interface UpdateProfileData {
  name?: string;
  lastName?: string;
  age?: number | null;
  gender?: string | null;
}

export interface PasswordResetCodeRecord {
  idCode: number;
  codeHash: string;
  attempts: number;
  createdAt: Date;
}

export interface AuthUserRepositoryPort {
  findByEmail(email: string): Promise<AuthUserEntity | null>;
  findById(idUser: number): Promise<AuthUserEntity | null>;
  findRoleByName(roleName: string): Promise<AuthRoleData | null>;
  createUser(data: CreateUserData): Promise<AuthUserEntity>;
  updateProfile(idUser: number, data: UpdateProfileData): Promise<AuthUserEntity | null>;
  updatePassword(idUser: number, passwordHash: string): Promise<void>;
  /** Guarda un código nuevo e invalida los anteriores del usuario. */
  createPasswordResetCode(idUser: number, codeHash: string, expiresAt: Date): Promise<void>;
  /** Último código sin usar y sin expirar del usuario. */
  findActivePasswordResetCode(idUser: number): Promise<PasswordResetCodeRecord | null>;
  incrementPasswordResetAttempts(idCode: number): Promise<void>;
  markPasswordResetCodeUsed(idCode: number): Promise<void>;
}
