import { AuthUserEntity } from '../../entities/auth-user.entity';

export const LOGIN_USE_CASE_PORT = Symbol('LOGIN_USE_CASE_PORT');

export interface LoginResult {
  access_token: string;
  user: {
    idUser: number;
    email: string;
    name: string;
    lastName: string;
    role: string;
  };
}

export interface LoginUseCasePort {
  validateUser(email: string, password: string): Promise<AuthUserEntity>;
  login(user: AuthUserEntity): Promise<LoginResult>;
}
