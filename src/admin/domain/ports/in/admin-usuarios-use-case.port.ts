export const ADMIN_USUARIOS_USE_CASE_PORT = Symbol('ADMIN_USUARIOS_USE_CASE_PORT');

export interface UsuarioAdminResumen {
  idUser: number;
  name: string;
  lastName: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: Date;
}

export interface BuscarUsuariosFiltro {
  /** Texto libre para buscar por nombre, apellido o correo electrónico. */
  q?: string;
  /** Filtrar por estado activo (true) o suspendido (false). */
  active?: boolean;
}

export interface SuspenderUsuarioCommand {
  idUser: number;
  idAdminGlobal: number;
  motivo?: string;
}

export interface AdminUsuariosUseCasePort {
  buscarUsuarios(filtro?: BuscarUsuariosFiltro): Promise<UsuarioAdminResumen[]>;
  suspenderUsuario(comando: SuspenderUsuarioCommand): Promise<UsuarioAdminResumen>;
}
