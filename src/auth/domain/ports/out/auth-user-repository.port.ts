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

export interface AuthUserRepositoryPort {
  findByEmail(email: string): Promise<AuthUserEntity | null>;
  findById(idUser: number): Promise<AuthUserEntity | null>;
  findRoleByName(roleName: string): Promise<AuthRoleData | null>;
  createUser(data: CreateUserData): Promise<AuthUserEntity>;
}
