import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArgumentsHost, HttpStatus, BadRequestException } from '@nestjs/common';
import { ZodError } from 'zod';
import { FastifyReply, FastifyRequest } from 'fastify';
import { TandaController } from '../src/tandas/infrastructure/adapters/in/http/tanda.controller';
import { TandaService } from '../src/tandas/application/services/tanda.service';
import { TandaRepositoryPort } from '../src/tandas/domain/ports/out/tanda-repository.port';
import { NumberRepositoryPort } from '../src/tandas/domain/ports/out/number-repository.port';
import { Tanda } from '../src/tandas/domain/entities/tanda.entity';
import { zCreateTanda } from '../src/tandas/application/dtos/create-tanda.dto';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ZodValidationExceptionFilter } from '../src/common/filters/zod-validation.filter';
import { AuthenticatedUser } from '../src/auth/infrastructure/adapters/in/http/strategies/jwt.strategy';

/**
 * [BE-TANDA] Validación mínima de participantes — Back-End (QA-03).
 *
 * Regla de negocio:
 *   participantes >= 3
 *
 * Mensaje exacto de validación:
 *   "Una tanda requiere al menos 3 participantes"
 */
describe('[BE-TANDA] Validación mínima de participantes (QA-03)', () => {
  let controller: TandaController;
  let service: TandaService;

  const mockCreate = vi.fn();
  const mockFindByInviteCode = vi.fn();
  const mockFindById = vi.fn();
  const mockUpdate = vi.fn();
  const mockUpdateStatus = vi.fn();
  const mockSoftDelete = vi.fn();
  const mockFindAll = vi.fn();

  const mockCreateNumber = vi.fn();
  const mockFindOccupiedNumbers = vi.fn();
  const mockFindByUserInTanda = vi.fn();
  const mockCountParticipants = vi.fn();
  const mockFindNumbersByTanda = vi.fn();

  const mockTandaRepo: TandaRepositoryPort = {
    create: mockCreate,
    findById: mockFindById,
    findByInviteCode: mockFindByInviteCode,
    update: mockUpdate,
    updateStatus: mockUpdateStatus,
    softDelete: mockSoftDelete,
    findAll: mockFindAll,
  };

  const mockNumberRepo: NumberRepositoryPort = {
    createNumber: mockCreateNumber,
    createNumbers: vi.fn(),
    countNumbersWithoutPayment: vi.fn().mockResolvedValue(0),
    findOccupiedNumbers: mockFindOccupiedNumbers,
    findByUserInTanda: mockFindByUserInTanda,
    countParticipants: mockCountParticipants,
    findNumbersByTanda: mockFindNumbersByTanda,
  };

  const mockUser: AuthenticatedUser = {
    idUser: 10,
    email: 'admin@tandea.test',
    role: 'usuario',
  };

  const validPayload = {
    name: 'Tanda de Prueba QA-03',
    description: 'Validación de mínimo de participantes',
    startDate: '2026-11-01',
    contributionAmount: 1000,
    numParticipants: 5,
    numRounds: 1,
    graceDays: 2,
    hasDeadNumber: false,
    idTandaType: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TandaService(mockTandaRepo, mockNumberRepo);
    controller = new TandaController(service);

    mockFindByInviteCode.mockResolvedValue(null);
    mockCreate.mockImplementation(async (t: Tanda) => {
      const p = t.toPrimitives();
      return new Tanda({ ...p, idTanda: 1 });
    });
  });

  describe('1. Validación en el límite de entrada (zCreateTanda DTO)', () => {
    it('debe rechazar cuando el campo numParticipants está ausente / omitido', () => {
      const body: Record<string, unknown> = { ...validPayload };
      delete body.numParticipants;

      const result = zCreateTanda.safeParse(body);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('numParticipants'));
        expect(issue).toBeDefined();
        expect(issue?.message).toBe(
          'El campo "numParticipants" (número de participantes) es obligatorio',
        );
      }
    });

    it('debe rechazar cuando numParticipants es null', () => {
      const result = zCreateTanda.safeParse({
        ...validPayload,
        numParticipants: null,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('numParticipants'));
        expect(issue).toBeDefined();
        expect(issue?.message).toBe(
          'El campo "numParticipants" debe ser un número entero',
        );
      }
    });

    it('debe rechazar cuando numParticipants es 0 con el mensaje exacto de la regla', () => {
      const result = zCreateTanda.safeParse({
        ...validPayload,
        numParticipants: 0,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('numParticipants'));
        expect(issue).toBeDefined();
        expect(issue?.message).toBe('Una tanda requiere al menos 3 participantes');
        expect(issue?.code).toBe('too_small');
      }
    });

    it('debe rechazar cuando numParticipants es 1 con el mensaje exacto', () => {
      const result = zCreateTanda.safeParse({
        ...validPayload,
        numParticipants: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('numParticipants'));
        expect(issue).toBeDefined();
        expect(issue?.message).toBe('Una tanda requiere al menos 3 participantes');
      }
    });

    it('debe rechazar cuando numParticipants es 2 (caso límite QA-03) con el mensaje exacto', () => {
      const result = zCreateTanda.safeParse({
        ...validPayload,
        numParticipants: 2,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('numParticipants'));
        expect(issue).toBeDefined();
        expect(issue?.message).toBe('Una tanda requiere al menos 3 participantes');
        expect(issue?.code).toBe('too_small');
      }
    });

    it('debe rechazar cuando numParticipants es negativo (ej. -3)', () => {
      const result = zCreateTanda.safeParse({
        ...validPayload,
        numParticipants: -3,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('numParticipants'));
        expect(issue).toBeDefined();
        expect(issue?.message).toBe('Una tanda requiere al menos 3 participantes');
      }
    });

    it('debe rechazar cuando numParticipants es decimal (ej. 3.5)', () => {
      const result = zCreateTanda.safeParse({
        ...validPayload,
        numParticipants: 3.5,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('numParticipants'));
        expect(issue).toBeDefined();
        expect(issue?.message).toBe('El número de participantes debe ser un número entero');
      }
    });

    it.each([
      ['cadena numérica', '3'],
      ['texto alfabético', 'cinco'],
      ['booleano', true],
      ['objeto', {}],
      ['array', [3]],
      ['NaN', Number.NaN],
    ])('debe rechazar valor de tipo no numérico: %s (%j)', (_desc, invalidVal) => {
      const result = zCreateTanda.safeParse({
        ...validPayload,
        numParticipants: invalidVal,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('numParticipants'));
        expect(issue).toBeDefined();
      }
    });

    it('debe aceptar cuando numParticipants es exactamente 3 (límite inferior válido)', () => {
      const result = zCreateTanda.safeParse({
        ...validPayload,
        numParticipants: 3,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.numParticipants).toBe(3);
      }
    });

    it('debe aceptar cuando numParticipants es mayor a 3 (ej. 4, 10, 50)', () => {
      for (const count of [4, 10, 25, 50]) {
        const result = zCreateTanda.safeParse({
          ...validPayload,
          numParticipants: count,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.numParticipants).toBe(count);
        }
      }
    });

    it('debe rechazar cuando numParticipants excede el límite máximo permitido (51)', () => {
      const result = zCreateTanda.safeParse({
        ...validPayload,
        numParticipants: 51,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('numParticipants'));
        expect(issue?.message).toBe('El número máximo de participantes permitido es 50');
      }
    });
  });

  describe('2. Adaptador primario HTTP (TandaController) y no persistencia', () => {
    it('debe rechazar con ZodError ante petición con 2 participantes y NO persistir', async () => {
      const invalidBody = {
        ...validPayload,
        numParticipants: 2,
      };

      const error = await controller.crearTanda(invalidBody, mockUser).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ZodError);
      const zodErr = error as ZodError;
      const issues = zodErr.errors.filter((e) => e.path.includes('numParticipants'));
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toBe('Una tanda requiere al menos 3 participantes');

      // Garantizar que no se llamó al repositorio ni se persistió nada
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockCreateNumber).not.toHaveBeenCalled();
    });

    it('debe rechazar ante petición con 0 participantes y NO persistir', async () => {
      const invalidBody = {
        ...validPayload,
        numParticipants: 0,
      };

      const error = await controller.crearTanda(invalidBody, mockUser).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ZodError);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockCreateNumber).not.toHaveBeenCalled();
    });

    it('debe rechazar ante petición sin numParticipants y NO persistir', async () => {
      const invalidBody: Record<string, unknown> = { ...validPayload };
      delete invalidBody.numParticipants;

      const error = await controller.crearTanda(invalidBody, mockUser).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ZodError);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockCreateNumber).not.toHaveBeenCalled();
    });

    it('debe rechazar ante petición con tipo string en numParticipants y NO persistir', async () => {
      const invalidBody = {
        ...validPayload,
        numParticipants: 'tres',
      };

      const error = await controller.crearTanda(invalidBody, mockUser).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ZodError);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockCreateNumber).not.toHaveBeenCalled();
    });

    it('debe procesar exitosamente la creación cuando numParticipants es exactamente 3', async () => {
      const validBody = {
        ...validPayload,
        numParticipants: 3,
      };

      const response = await controller.crearTanda(validBody, mockUser);

      expect(response.statusCode).toBe(HttpStatus.CREATED);
      expect(response.mensaje).toBe('Tanda creada exitosamente');
      expect(response.data.numParticipants).toBe(3);
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    it('debe procesar exitosamente la creación cuando numParticipants es mayor a 3', async () => {
      const validBody = {
        ...validPayload,
        numParticipants: 8,
      };

      const response = await controller.crearTanda(validBody, mockUser);

      expect(response.statusCode).toBe(HttpStatus.CREATED);
      expect(response.data.numParticipants).toBe(8);
      expect(mockCreate).toHaveBeenCalledOnce();
    });
  });

  describe('3. Capa de Aplicación (TandaService.crearTanda)', () => {
    it('debe rechazar con BadRequestException si se invoca con numParticipants < 3', async () => {
      await expect(
        service.crearTanda({
          ...validPayload,
          numParticipants: 2,
          idAdmin: 10,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockFindByInviteCode).not.toHaveBeenCalled();
    });

    it('debe rechazar con BadRequestException si numParticipants es 0', async () => {
      await expect(
        service.crearTanda({
          ...validPayload,
          numParticipants: 0,
          idAdmin: 10,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('debe persistir normalmente cuando numParticipants es 3', async () => {
      const result = await service.crearTanda({
        ...validPayload,
        numParticipants: 3,
        idAdmin: 10,
      });

      expect(result).toBeDefined();
      expect(result.numParticipants).toBe(3);
      expect(mockCreate).toHaveBeenCalledOnce();
    });
  });

  describe('4. Entidad de Dominio (Tanda)', () => {
    it('debe lanzar Error si se instancia Tanda con menos de 3 participantes', () => {
      expect(() => {
        new Tanda({
          name: 'Tanda Invalida',
          startDate: '2026-11-01',
          contributionAmount: 500,
          numParticipants: 2,
          numRounds: 1,
          graceDays: 0,
          hasDeadNumber: false,
          idTandaType: 1,
          idAdmin: 10,
          inviteCode: 'TND-TEST01',
        });
      }).toThrow('Una tanda requiere al menos 3 participantes');
    });

    it('debe permitir instanciar Tanda con exactamente 3 participantes', () => {
      const tanda = new Tanda({
        name: 'Tanda Válida',
        startDate: '2026-11-01',
        contributionAmount: 500,
        numParticipants: 3,
        numRounds: 1,
        graceDays: 0,
        hasDeadNumber: false,
        idTandaType: 1,
        idAdmin: 10,
        inviteCode: 'TND-TEST01',
      });

      expect(tanda.numParticipants).toBe(3);
      expect(tanda.status).toBe('PENDIENTE');
    });

    it('debe permitir instanciar Tanda con más de 3 participantes', () => {
      const tanda = new Tanda({
        name: 'Tanda Válida Mayor',
        startDate: '2026-11-01',
        contributionAmount: 500,
        numParticipants: 12,
        numRounds: 1,
        graceDays: 0,
        hasDeadNumber: false,
        idTandaType: 1,
        idAdmin: 10,
        inviteCode: 'TND-TEST02',
      });

      expect(tanda.numParticipants).toBe(12);
    });
  });

  describe('5. Formato de respuesta de error en Filtros Globales (Contrato HTTP)', () => {
    it('GlobalExceptionFilter debe transformar ZodError en HTTP 422 con formato estructurado', () => {
      const parseResult = zCreateTanda.safeParse({
        ...validPayload,
        numParticipants: 2,
      });
      expect(parseResult.success).toBe(false);
      if (parseResult.success) return;

      const mockSend = vi.fn();
      const mockStatus = vi.fn().mockReturnValue({ send: mockSend });
      const mockHost = {
        switchToHttp: () => ({
          getResponse: () => ({ status: mockStatus }) as unknown as FastifyReply,
          getRequest: () => ({ url: '/api/v1/tandas' }) as unknown as FastifyRequest,
        }),
      } as unknown as ArgumentsHost;

      const filter = new GlobalExceptionFilter();
      filter.catch(parseResult.error, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 422,
          error: 'Unprocessable Entity',
          message: 'Una tanda requiere al menos 3 participantes',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'numParticipants',
              message: 'Una tanda requiere al menos 3 participantes',
              code: 'too_small',
            }),
          ]),
        }),
      );
    });

    it('ZodValidationExceptionFilter debe transformar ZodError en HTTP 422', () => {
      const parseResult = zCreateTanda.safeParse({
        ...validPayload,
        numParticipants: 0,
      });
      expect(parseResult.success).toBe(false);
      if (parseResult.success) return;

      const mockSend = vi.fn();
      const mockStatus = vi.fn().mockReturnValue({ send: mockSend });
      const mockHost = {
        switchToHttp: () => ({
          getResponse: () => ({ status: mockStatus }) as unknown as FastifyReply,
        }),
      } as unknown as ArgumentsHost;

      const filter = new ZodValidationExceptionFilter();
      filter.catch(parseResult.error, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 422,
          error: 'Unprocessable Entity',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'numParticipants',
              message: 'Una tanda requiere al menos 3 participantes',
            }),
          ]),
        }),
      );
    });

    it('GlobalExceptionFilter debe capturar violación de invariante de dominio como HTTP 400 Bad Request', () => {
      const domainError = new Error('Una tanda requiere al menos 3 participantes');

      const mockSend = vi.fn();
      const mockStatus = vi.fn().mockReturnValue({ send: mockSend });
      const mockHost = {
        switchToHttp: () => ({
          getResponse: () => ({ status: mockStatus }) as unknown as FastifyReply,
          getRequest: () => ({ url: '/api/v1/tandas' }) as unknown as FastifyRequest,
        }),
      } as unknown as ArgumentsHost;

      const filter = new GlobalExceptionFilter();
      filter.catch(domainError, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          error: 'Bad Request',
          code: 'DOMAIN_RULE_VIOLATION',
          message: 'Una tanda requiere al menos 3 participantes',
        }),
      );
    });
  });
});
