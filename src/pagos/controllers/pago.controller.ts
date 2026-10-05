import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import {
  zPagoCreate,
  zPagoResponse,
  type CreatePagoDto,
  type PagoResponseDto,
} from '../contracts/pago.contract';
import { toPagoResponse } from '../repositories/mappers/pago.mapper';
import { PagoService } from '../services/pago.service';

/**
 * PagoController — Capa de transporte HTTP.
 *
 * Responsabilidades (y SOLO estas):
 *  1. Recibir el request HTTP.
 *  2. Validar el body explícitamente con zPagoCreate.parse() antes de delegar al Service.
 *  3. Llamar al Service con el DTO tipado y validado.
 *  4. Mapear el PagoModel al DTO de respuesta con toPagoResponse().
 *  5. Validar la respuesta con zPagoResponse.parse() antes de retornar.
 *     → Esto actúa como una capa de seguridad que previene filtración de campos sensibles.
 *
 * Lo que NO hace:
 *  - Lógica de negocio de ningún tipo.
 *  - Acceso a la base de datos.
 *  - Transformaciones de datos más allá del mapeo final.
 */
@Controller('pagos')
export class PagoController {
  constructor(private readonly pagoService: PagoService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // POST /pagos — Crear un nuevo pago
  // ─────────────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crearPago(@Body() body: unknown): Promise<PagoResponseDto> {
    // ✅ Paso 1: Validación explícita con Zod
    // zPagoCreate.parse() lanza ZodError si el body es inválido.
    // El filtro global ZodValidationExceptionFilter lo captura y retorna 422.
    const dto: CreatePagoDto = zPagoCreate.parse(body);

    // ✅ Paso 2: Delegar al servicio con el DTO validado y tipado
    const pagoModel = await this.pagoService.crearPago(dto);

    // ✅ Paso 3: Mapear modelo de dominio a DTO de respuesta
    const responseData = toPagoResponse(pagoModel);

    // ✅ Paso 4: Validar la respuesta saliente con Zod
    // Garantiza que la estructura de salida siempre sea correcta,
    // y actúa como firewall contra filtración de campos no deseados.
    return zPagoResponse.parse(responseData);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /pagos/:id — Obtener un pago por ID
  // ─────────────────────────────────────────────────────────────────────────

  @Get(':id')
  async obtenerPago(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PagoResponseDto> {
    const pagoModel = await this.pagoService.obtenerPago(id);
    return zPagoResponse.parse(toPagoResponse(pagoModel));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /pagos/:id/confirmar-organizador
  // ─────────────────────────────────────────────────────────────────────────

  @Patch(':id/confirmar-organizador')
  async confirmarOrganizador(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PagoResponseDto> {
    const pagoModel = await this.pagoService.confirmarOrganizador(id);
    return zPagoResponse.parse(toPagoResponse(pagoModel));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /pagos/:id/confirmar-receptor
  // ─────────────────────────────────────────────────────────────────────────

  @Patch(':id/confirmar-receptor')
  async confirmarReceptor(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PagoResponseDto> {
    const pagoModel = await this.pagoService.confirmarReceptor(id);
    return zPagoResponse.parse(toPagoResponse(pagoModel));
  }
}
