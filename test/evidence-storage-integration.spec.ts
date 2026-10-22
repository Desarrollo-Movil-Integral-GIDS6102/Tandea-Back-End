import { describe, it, expect, vi } from 'vitest';
import { StoragePort } from '../src/pagos/domain/ports/out/storage.port';
import {
  EvidenceRepositoryPort,
  EvidenceRecord,
} from '../src/pagos/domain/ports/out/evidence-repository.port';

describe('Flujo de Integración: Subida y Guardado de Comprobante en evidence.file_url', () => {
  it('debe orquestar la subida del buffer con StoragePort y persistir la URL en evidence.file_url', async () => {
    // 1. Mock de StoragePort (CloudinaryAdapter)
    const mockStoragePort: StoragePort = {
      subir: vi.fn().mockResolvedValue(
        'https://res.cloudinary.com/tandea/image/upload/v1234/comprobantes/comprobante_pago_45.webp',
      ),
    };

    // 2. Mock de EvidenceRepositoryPort (DrizzleEvidenceRepository)
    const savedRecords: EvidenceRecord[] = [];
    const mockEvidenceRepo: EvidenceRepositoryPort = {
      guardarComprobantePago: vi.fn().mockImplementation(async (props) => {
        const record: EvidenceRecord = {
          idEvidence: 1,
          idPayment: props.idPayment,
          idPayout: null,
          fileUrl: props.fileUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        savedRecords.push(record);
        return record;
      }),
      obtenerEvidenciasPorPago: vi.fn().mockResolvedValue(savedRecords),
    };

    // 3. Simular Caso de Uso: participante sube comprobante para idPayment = 45
    const fakeBuffer = Buffer.from('comprobante_spei_banxico');
    const idPayment = 45;

    // Ejecución del flujo
    const secureUrl = await mockStoragePort.subir(fakeBuffer, {
      carpeta: 'comprobantes',
      nombreArchivo: `pago_${idPayment}`,
    });

    const evidenciaGuardada = await mockEvidenceRepo.guardarComprobantePago({
      idPayment,
      fileUrl: secureUrl,
    });

    // Verificaciones de Criterios de Aceptación:
    expect(mockStoragePort.subir).toHaveBeenCalledWith(fakeBuffer, {
      carpeta: 'comprobantes',
      nombreArchivo: `pago_${idPayment}`,
    });

    // 1. Devuelve la URL de Cloudinary
    expect(secureUrl).toContain('https://res.cloudinary.com');
    expect(secureUrl).toContain('/comprobantes/');

    // 2. La URL queda guardada en evidence.file_url vinculada al idPayment
    expect(mockEvidenceRepo.guardarComprobantePago).toHaveBeenCalledWith({
      idPayment: 45,
      fileUrl: secureUrl,
    });

    expect(evidenciaGuardada.idPayment).toBe(45);
    expect(evidenciaGuardada.idPayout).toBeNull();
    expect(evidenciaGuardada.fileUrl).toBe(secureUrl);
  });
});
