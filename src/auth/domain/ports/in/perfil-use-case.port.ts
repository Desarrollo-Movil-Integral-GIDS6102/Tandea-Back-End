export const PERFIL_USE_CASE_PORT = Symbol('PERFIL_USE_CASE_PORT');

export interface PerfilUsuario {
  idUser: number;
  email: string;
  name: string;
  lastName: string;
  age: number | null;
  gender: string | null;
  role: string;
}

export interface ActualizarPerfilCommand {
  name?: string;
  lastName?: string;
  age?: number | null;
  gender?: string | null;
}

export interface PerfilUseCasePort {
  obtenerPerfil(idUser: number): Promise<PerfilUsuario>;
  actualizarPerfil(idUser: number, command: ActualizarPerfilCommand): Promise<PerfilUsuario>;
  /** Envía al correo del usuario un código de 6 dígitos válido por 10 minutos. */
  solicitarCodigoPassword(idUser: number): Promise<void>;
  cambiarPassword(idUser: number, codigo: string, nuevaPassword: string): Promise<void>;
}
