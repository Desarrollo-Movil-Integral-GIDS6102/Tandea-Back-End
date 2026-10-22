/**
 * Opciones para la subida de archivos al almacenamiento digital.
 */
export interface SubirArchivoOpciones {
  carpeta?: string;
  nombreArchivo?: string;
  mimetype?: string;
}

/**
 * Token de Inyección de Dependencias para el puerto de Almacenamiento.
 */
export const STORAGE_PORT = Symbol('STORAGE_PORT');

/**
 * Puerto Secundario / Salida (Driven Port): StoragePort
 *
 * En Arquitectura Hexagonal:
 * - Define el contrato para subir archivos (comprobantes, evidencias, etc.) sin depender de un proveedor concreto.
 * - Los adaptadores de infraestructura (CloudinaryAdapter, FirebaseStorageAdapter, S3Adapter) implementan este puerto.
 */
export interface StoragePort {
  /**
   * Sube un buffer binario al almacenamiento y retorna la URL pública segura del recurso.
   *
   * @param buffer Contenido binario del archivo a subir.
   * @param opciones Opciones opcionales de carpeta o nombre.
   * @returns Promesa que resuelve a la URL segura (`string`) del archivo subido.
   */
  subir(buffer: Buffer, opciones?: SubirArchivoOpciones): Promise<string>;
}
