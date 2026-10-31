import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileInterceptor,
  type UploadedMultipartFile,
} from '@nestjs/platform-fastify/multipart';
import { JwtAuthGuard } from '../../../../../auth/infrastructure/adapters/in/http/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../auth/infrastructure/adapters/in/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../../../auth/infrastructure/adapters/in/http/strategies/jwt.strategy';
import {
  comprobanteMultipartOptions,
  validarComprobante,
} from '../../../../../pagos/infrastructure/adapters/in/http/multipart/comprobante.file';
import { zRegistrarEntrega, zReportarProblema } from '../../../../application/dtos/entrega.dto';
import {
  ENTREGA_USE_CASES_PORT,
  type EntregaUseCasesPort,
} from '../../../../domain/ports/in/entrega-use-cases.port';

@Controller('entregas')
@UseGuards(JwtAuthGuard)
export class EntregaController {
  constructor(
    @Inject(ENTREGA_USE_CASES_PORT)
    private readonly entregas: EntregaUseCasesPort,
  ) {}

  /**
   * POST /entregas (multipart/form-data)
   * El organizador registra la entrega del turno vigente con su evidencia.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', comprobanteMultipartOptions))
  async registrar(
    @Body() body: unknown,
    @UploadedFile() file: UploadedMultipartFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const dto = zRegistrarEntrega.parse(body ?? {});
    if (!file) {
      throw new BadRequestException('Adjunta la foto de evidencia de la entrega');
    }
    const data = await this.entregas.registrar(
      { ...dto, evidencia: validarComprobante(file) },
      user,
    );
    return { statusCode: HttpStatus.CREATED, data };
  }

  /** GET /entregas/:id */
  @Get(':id')
  async obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return { statusCode: HttpStatus.OK, data: await this.entregas.obtener(id, user) };
  }

  /**
   * PATCH /entregas/:id/confirmar
   * El dueño del número confirma que recibió el dinero y se cierra el turno.
   */
  @Patch(':id/confirmar')
  async confirmar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return { statusCode: HttpStatus.OK, data: await this.entregas.confirmar(id, user) };
  }

  /**
   * POST /entregas/:id/problema
   * El receptor reporta un problema: abre una disputa y el turno sigue sin cerrar.
   */
  @Post(':id/problema')
  @HttpCode(HttpStatus.CREATED)
  async reportarProblema(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { motivo } = zReportarProblema.parse(body ?? {});
    await this.entregas.reportarProblema(id, motivo, user);
    return { statusCode: HttpStatus.CREATED, mensaje: 'Reportamos el problema al administrador' };
  }
}
