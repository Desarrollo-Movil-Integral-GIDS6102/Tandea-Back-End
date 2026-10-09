import { AuthUserEntity } from '../../entities/auth-user.entity';

export const AUTH_USER_REPOSITORY_PORT = Symbol('AUTH_USER_REPOSITORY_PORT');

export interface AuthUserRepositoryPort {
  findByEmail(email: string): Promise<AuthUserEntity | null>;
  findById(idUser: number): Promise<AuthUserEntity | null>;
}
