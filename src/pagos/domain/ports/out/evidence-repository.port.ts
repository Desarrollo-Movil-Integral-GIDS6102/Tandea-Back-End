export interface GuardarEvidenceProps {
  idPayment: number;
  fileUrl: string;
}

export interface EvidenceRecord {
  idEvidence: number;
  idPayment: number | null;
  idPayout: number | null;
  fileUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export const EVIDENCE_REPOSITORY_PORT = Symbol('EVIDENCE_REPOSITORY_PORT');

/**
 * Puerto de Salida: EvidenceRepositoryPort
 *
 * En Arquitectura Hexagonal:
 * - Define el contrato para persistir evidencias (comprobantes de pago) en la tabla evidence.
 */
export interface EvidenceRepositoryPort {
  /**
   * Guarda un comprobante vinculado a un pago en la tabla evidence.
   */
  guardarComprobantePago(props: GuardarEvidenceProps): Promise<EvidenceRecord>;

  /**
   * Busca las evidencias vinculadas a un pago.
   */
  obtenerEvidenciasPorPago(idPayment: number): Promise<EvidenceRecord[]>;
}
