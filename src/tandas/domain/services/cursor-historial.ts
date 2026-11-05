import type { CursorHistorial } from '../ports/out/tanda-repository.port';

/**
 * El cursor del historial viaja al cliente como texto opaco (base64url de
 * fecha|tipo|id) para que no dependa del formato interno.
 */
export function codificarCursor(cursor: CursorHistorial): string {
  return Buffer.from(`${cursor.fecha}|${cursor.tipo}|${cursor.id}`, 'utf8').toString('base64url');
}

/** Devuelve null si el texto no es un cursor válido. */
export function decodificarCursor(texto: string): CursorHistorial | null {
  const partes = Buffer.from(texto, 'base64url').toString('utf8').split('|');
  if (partes.length !== 3) return null;

  const [fecha, tipo, idTexto] = partes;
  const id = Number(idTexto);
  const fechaValida = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(fecha);
  if (!fechaValida || (tipo !== 'PAGO' && tipo !== 'COBRO') || !Number.isInteger(id) || id <= 0) {
    return null;
  }
  return { fecha, tipo, id };
}
