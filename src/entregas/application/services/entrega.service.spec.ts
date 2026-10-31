import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntregaService } from './entrega.service';
import type {
  EntregaRecord,
  EntregaRepositoryPort,
  NumeroParaEntrega,
} from '../../domain/ports/out/entrega-repository.port';

const ORGANIZADOR = { idUser: 10, role: 'usuario' };
const RECEPTOR = { idUser: 30, role: 'usuario' };

const numero = (extra: Partial<NumeroParaEntrega> = {}): NumeroParaEntrega => ({
  idNumber: 5,
  numberValue: 1,
  idUser: 30,
  isDeadNumber: false,
  status: 'PENDIENTE',
  idTanda: 7,
  idAdmin: 10,
  tandaStatus: 'ACTIVA',
  contributionAmount: 100,
  numParticipants: 3,
  ...extra,
});

const entrega = { idPayout: 1, idTanda: 7, idUser: 30, idAdmin: 10 } as EntregaRecord;
const evidencia = { buffer: Buffer.from('x'), mimetype: 'image/jpeg', nombreOriginal: 'e.jpg' };

describe('EntregaService', () => {
  let repo: { [K in keyof EntregaRepositoryPort]: ReturnType<typeof vi.fn> };
  let storage: { subir: ReturnType<typeof vi.fn> };
  let service: EntregaService;

  const registrar = (usuario = ORGANIZADOR, montos = { transferAmount: 300, cashAmount: 0 }) =>
    service.registrar({ idNumber: 5, ...montos, evidencia }, usuario);

  beforeEach(() => {
    repo = {
      buscarNumero: vi.fn().mockResolvedValue(numero()),
      buscarTurnoVigente: vi.fn().mockResolvedValue(5),
      registrar: vi.fn().mockResolvedValue(1),
      buscarPorId: vi.fn().mockResolvedValue(entrega),
      confirmarRecepcion: vi.fn().mockResolvedValue(true),
      crearDisputa: vi.fn(),
    };
    storage = { subir: vi.fn().mockResolvedValue('https://img/e.jpg') };
    service = new EntregaService(repo as unknown as EntregaRepositoryPort, storage);
  });

  it('el organizador registra la entrega del turno vigente con su evidencia', async () => {
    await registrar();

    expect(repo.registrar).toHaveBeenCalledWith({
      idNumber: 5,
      transferAmount: 300,
      cashAmount: 0,
      totalAmount: 300,
      evidenceUrl: 'https://img/e.jpg',
    });
  });

  it('solo el organizador puede registrar', async () => {
    await expect(registrar(RECEPTOR)).rejects.toThrow('Solo el organizador');
    expect(storage.subir).not.toHaveBeenCalled();
  });

  it('rechaza un número que no es el turno vigente', async () => {
    repo.buscarTurnoVigente.mockResolvedValue(6);

    await expect(registrar()).rejects.toThrow('Aún no es el turno del número #1');
  });

  it('rechaza si el turno ya tiene entrega', async () => {
    repo.buscarNumero.mockResolvedValue(numero({ status: 'ENTREGA_PENDIENTE_CONFIRMACION' }));

    await expect(registrar()).rejects.toThrow('ya tiene una entrega');
  });

  it('rechaza montos que no suman la cuota por los números', async () => {
    await expect(registrar(ORGANIZADOR, { transferAmount: 100, cashAmount: 100 })).rejects.toThrow(
      'Los montos deben sumar 300.00',
    );
    expect(storage.subir).not.toHaveBeenCalled();
  });

  it('rechaza el número muerto y las tandas que no están en curso', async () => {
    repo.buscarNumero.mockResolvedValue(numero({ isDeadNumber: true, idUser: null }));
    await expect(registrar()).rejects.toThrow('participante');

    repo.buscarNumero.mockResolvedValue(numero({ tandaStatus: 'PENDIENTE' }));
    await expect(registrar()).rejects.toThrow('no está en curso');
  });

  it('el dueño del número confirma la recepción; nadie más puede', async () => {
    await service.confirmar(1, RECEPTOR);
    expect(repo.confirmarRecepcion).toHaveBeenCalledWith(1);

    await expect(service.confirmar(1, ORGANIZADOR)).rejects.toThrow('quien recibe');
  });

  it('no se confirma dos veces', async () => {
    repo.confirmarRecepcion.mockResolvedValue(false);

    await expect(service.confirmar(1, RECEPTOR)).rejects.toThrow('ya fue confirmada');
  });

  it('el receptor reporta un problema como disputa', async () => {
    await service.reportarProblema(1, 'No llegó', RECEPTOR);

    expect(repo.crearDisputa).toHaveBeenCalledWith(7, 1, 30, 'No llegó');
  });

  it('un tercero no puede ver la entrega', async () => {
    await expect(service.obtener(1, { idUser: 99, role: 'usuario' })).rejects.toThrow('permisos');
  });
});
