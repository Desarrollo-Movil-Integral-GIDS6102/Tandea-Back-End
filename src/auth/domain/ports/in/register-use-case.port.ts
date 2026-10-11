export const REGISTER_USE_CASE_PORT = Symbol('REGISTER_USE_CASE_PORT');

export interface RegisterCommand {
  email: string;
  password: string;
  name: string;
  lastName: string;
  age?: number | null;
  gender?: string | null;
}

export interface RegisterResult {
  access_token: string;
  user: {
    idUser: number;
    email: string;
    name: string;
    lastName: string;
    role: string;
    age?: number | null;
    gender?: string | null;
  };
}

export interface RegisterUseCasePort {
  register(command: RegisterCommand): Promise<RegisterResult>;
}
