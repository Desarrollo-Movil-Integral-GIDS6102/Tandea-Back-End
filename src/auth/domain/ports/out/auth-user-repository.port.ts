import { AuthUserEntity } from '../../entities/auth-user.entity';

export const AUTH_USER_REPOSITORY_PORT = Symbol('AUTH_USER_REPOSITORY_PORT');

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
  lastName: string;
  idRole: number;
  age?: number;
  gender?: string;
  active?: boolean;
}

export interface AuthUserRepositoryPort {
  findByEmail(email: string): Promise<AuthUserEntity | null>;
  findById(idUser: number): Promise<AuthUserEntity | null>;
  findRoleByName(
    nameRole: string,
  ): Promise<{ idRole: number; nameRole: string } | null>;
  createUser(data: CreateUserData): Promise<AuthUserEntity>;
}
