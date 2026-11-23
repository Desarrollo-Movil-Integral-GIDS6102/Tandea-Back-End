import type {
  BuscarUsuariosFiltro,
  UsuarioAdminResumen,
} from '../in/admin-usuarios-use-case.port';

export const ADMIN_USUARIOS_REPOSITORY_PORT = Symbol('ADMIN_USUARIOS_REPOSITORY_PORT');

export interface RegistroAuditoriaUsuario {
  idAdminGlobal: number;
  idUsuarioAfectado: number;
  actionType: string;
  description: string;
}

export interface AdminUsuariosRepositoryPort {
  buscarUsuarios(filtro?: BuscarUsuariosFiltro): Promise<UsuarioAdminResumen[]>;
  obtenerPorId(idUser: number): Promise<UsuarioAdminResumen | null>;
  suspenderConAuditoria(registro: RegistroAuditoriaUsuario): Promise<UsuarioAdminResumen>;
}
