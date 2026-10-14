import { describe, it, expect, vi } from 'vitest';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpStatus, NotFoundException } from '@nestjs/common';
import { ZodError, z } from 'zod';

describe('[COMMON] GlobalExceptionFilter — Manejo de Errores y Buenas Prácticas REST', () => {
  const filter = new GlobalExceptionFilter();

  const createMockHost = (url = '/api/v1/tandas') => {
    const mockSend = vi.fn();
    const mockStatus = vi.fn().mockReturnValue({ send: mockSend });
    const mockResponse = { status: mockStatus };
    const mockRequest = { url };

    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;

    return { mockHost, mockStatus, mockSend };
  };

  it('debe transformar ZodError en 422 Unprocessable Entity con campo y mensaje específico', () => {
    const schema = z.object({
      name: z.string({ required_error: 'El campo "name" es obligatorio' }),
      amount: z.number({ invalid_type_error: 'El campo "amount" debe ser un número' }),
    });

    let zodError: ZodError | null = null;
    try {
      schema.parse({ amount: 'mil' }); // falta name y amount es string
    } catch (err) {
      zodError = err as ZodError;
    }

    const { mockHost, mockStatus, mockSend } = createMockHost();
    filter.catch(zodError!, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 422,
        error: 'Unprocessable Entity',
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'name', message: 'El campo "name" es obligatorio' }),
          expect.objectContaining({ field: 'amount', message: 'El campo "amount" debe ser un número' }),
        ]),
      }),
    );
  });

  it('debe transformar error de Clave Foránea (Postgres 23503) en 400 Bad Request indicando qué recurso no existe', () => {
    const pgError = {
      code: '23503',
      detail: 'Key (id_tanda_type)=(99) is not present in table "tanda_type".',
    };

    const { mockHost, mockStatus, mockSend } = createMockHost();
    filter.catch(pgError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        code: 'FOREIGN_KEY_NOT_FOUND',
        field: 'id_tanda_type',
        message: "El valor '99' para el campo 'id_tanda_type' no existe en la tabla de referencia 'tanda_type'.",
      }),
    );
  });

  it('debe transformar error de Duplicado Único (Postgres 23505) en 409 Conflict indicando el campo duplicado', () => {
    const pgError = {
      code: '23505',
      detail: 'Key (invite_code)=(TND-ABC123) already exists.',
    };

    const { mockHost, mockStatus, mockSend } = createMockHost();
    filter.catch(pgError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        error: 'Conflict',
        code: 'DUPLICATE_ENTRY',
        field: 'invite_code',
        message: "El valor 'TND-ABC123' para el campo 'invite_code' ya se encuentra registrado y debe ser único.",
      }),
    );
  });

  it('debe transformar error Not Null (Postgres 23502) en 400 Bad Request', () => {
    const pgError = {
      code: '23502',
      column: 'start_date',
    };

    const { mockHost, mockStatus, mockSend } = createMockHost();
    filter.catch(pgError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        field: 'start_date',
        message: "El campo 'start_date' es obligatorio y no puede ser nulo en la base de datos.",
      }),
    );
  });

  it('debe preservar HttpException nativa de NestJS (ej. 404 NotFoundException)', () => {
    const notFound = new NotFoundException('Tanda con id 5 no encontrada');

    const { mockHost, mockStatus, mockSend } = createMockHost();
    filter.catch(notFound, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Tanda con id 5 no encontrada',
      }),
    );
  });

  it('debe transformar violaciones de invariantes de Dominio en 400 Bad Request', () => {
    const domainError = new Error('Una tanda debe tener al menos 2 participantes');

    const { mockHost, mockStatus, mockSend } = createMockHost();
    filter.catch(domainError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'DOMAIN_RULE_VIOLATION',
        message: 'Una tanda debe tener al menos 2 participantes',
      }),
    );
  });
});
