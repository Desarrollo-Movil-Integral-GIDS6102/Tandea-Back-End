import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MailPort } from '../../../../../common/ports/out/mail.port';
import { EmailTemplates } from '../../../../../common/templates/mail/email-templates';
import { AdminDisputasService } from '../../../../application/services/admin-disputas.service';
import { AdminUsuariosService } from '../../../../application/services/admin-usuarios.service';
import type { DisputaDetalle } from '../../../../domain/ports/in/admin-disputas-use-case.port';
import type { UsuarioAdminResumen } from '../../../../domain/ports/in/admin-usuarios-use-case.port';
import type { AdminDisputasRepositoryPort } from '../../../../domain/ports/out/admin-disputas-repository.port';
import {
  DISPUTA_RESUELTA_EVENT,
  USUARIO_SUSPENDIDO_EVENT,
} from '../../../../domain/ports/out/admin-events.port';
import type { AdminUsuariosRepositoryPort } from '../../../../domain/ports/out/admin-usuarios-repository.port';
import { EventEmitterAdminEventsAdapter } from '../../out/events/event-emitter-admin-events.adapter';
import { AdminEventsListener } from './admin-events.listener';

function crearUsuarioEjemplo(): UsuarioAdminResumen {
  return {
    idUser: 15,
    name: 'Carlos',
    lastName: 'Ramírez',
    email: 'carlos@tandea.com',
    role: 'usuario',
    active: true,
    createdAt: new Date('2026-10-10T12:00:00.000Z'),
  };
}

function crearDisputaEjemplo(): DisputaDetalle {
  return {
    idDispute: 10,
    idTanda: 3,
    nombreTanda: 'Tanda Oficina',
    idReporter: 7,
    nombreReporter: 'Ana López',
    emailReporter: 'ana@tandea.com',
    idResolver: null,
    reason: 'No se reflejó mi pago en transferencia',
    status: 'ABIERTA',
    resolutionNotes: null,
    idPayment: 45,
    idPayout: null,
    createdAt: new Date('2026-11-10T12:00:00.000Z'),
    updatedAt: new Date('2026-11-10T12:00:00.000Z'),
    resolvedAt: null,
    bitacora: [],
  };
}

describe('[SP-4 INT-ADMIN] AdminEventsListener y EventEmitterAdminEventsAdapter', () => {
  let mailPort: { sendMail: ReturnType<typeof vi.fn> };
  let listener: AdminEventsListener;
  let eventEmitter: EventEmitter2;
  let eventsAdapter: EventEmitterAdminEventsAdapter;

  beforeEach(() => {
    mailPort = {
      sendMail: vi.fn().mockResolvedValue(true),
    };
    listener = new AdminEventsListener(mailPort as unknown as MailPort);
    eventEmitter = new EventEmitter2();
    eventEmitter.on(USUARIO_SUSPENDIDO_EVENT, (ev) => listener.onUsuarioSuspendido(ev));
    eventEmitter.on(DISPUTA_RESUELTA_EVENT, (ev) => listener.onDisputaResuelta(ev));
    eventsAdapter = new EventEmitterAdminEventsAdapter(eventEmitter);
  });

  describe('a) Suspensión de usuario -> evento usuario.suspendido -> correo de suspensión', () => {
    it('al suspender un usuario se emite usuario.suspendido y el listener envía el correo con EmailTemplates.userSuspended', async () => {
      const repoUsuarios: Partial<AdminUsuariosRepositoryPort> = {
        obtenerPorId: vi.fn().mockResolvedValue(crearUsuarioEjemplo()),
        suspenderConAuditoria: vi
          .fn()
          .mockResolvedValue({ ...crearUsuarioEjemplo(), active: false }),
      };

      const usuariosService = new AdminUsuariosService(
        repoUsuarios as AdminUsuariosRepositoryPort,
        eventsAdapter,
      );

      const resultado = await usuariosService.suspenderUsuario({
        idUser: 15,
        idAdminGlobal: 1,
        motivo: 'Incumplimiento reiterado de pagos',
      });

      expect(resultado.active).toBe(false);
      expect(mailPort.sendMail).toHaveBeenCalledOnce();

      const plantillaEsperada = EmailTemplates.userSuspended({
        name: 'Carlos',
        motivo: 'Incumplimiento reiterado de pagos',
      });

      expect(mailPort.sendMail).toHaveBeenCalledWith({
        to: 'carlos@tandea.com',
        subject: plantillaEsperada.subject,
        htmlContent: plantillaEsperada.html,
      });
    });
  });

  describe('b) Resolución de disputa -> evento disputa.resuelta -> correo con resumen', () => {
    it('al resolver una disputa se emite disputa.resuelta y el listener envía el correo con EmailTemplates.disputeResolved', async () => {
      const repoDisputas: Partial<AdminDisputasRepositoryPort> = {
        obtenerPorId: vi.fn().mockResolvedValue(crearDisputaEjemplo()),
        resolverConAuditoria: vi.fn().mockResolvedValue({
          ...crearDisputaEjemplo(),
          status: 'RESUELTA',
          idResolver: 1,
          resolutionNotes: 'Comprobante bancario verificado y aprobado',
        }),
      };

      const disputasService = new AdminDisputasService(
        repoDisputas as AdminDisputasRepositoryPort,
        eventsAdapter,
      );

      const resultado = await disputasService.resolverDisputa({
        idDispute: 10,
        idAdminGlobal: 1,
        accion: 'mantener',
        notas: 'Comprobante bancario verificado y aprobado',
      });

      expect(resultado.status).toBe('RESUELTA');
      expect(mailPort.sendMail).toHaveBeenCalledOnce();

      const plantillaEsperada = EmailTemplates.disputeResolved({
        name: 'Ana López',
        idDispute: 10,
        nombreTanda: 'Tanda Oficina',
        accion: 'mantener',
        notas: 'Comprobante bancario verificado y aprobado',
      });

      expect(mailPort.sendMail).toHaveBeenCalledWith({
        to: 'ana@tandea.com',
        subject: plantillaEsperada.subject,
        htmlContent: plantillaEsperada.html,
      });
    });
  });

  describe('c) Resiliencia cuando MailPort.sendMail falla o rechaza la promesa', () => {
    it('si MailPort.sendMail retorna false al suspender usuario, registra el error en Logger y no rompe la operación', async () => {
      mailPort.sendMail.mockResolvedValue(false);
      const loggerSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      const repoUsuarios: Partial<AdminUsuariosRepositoryPort> = {
        obtenerPorId: vi.fn().mockResolvedValue(crearUsuarioEjemplo()),
        suspenderConAuditoria: vi
          .fn()
          .mockResolvedValue({ ...crearUsuarioEjemplo(), active: false }),
      };

      const usuariosService = new AdminUsuariosService(
        repoUsuarios as AdminUsuariosRepositoryPort,
        eventsAdapter,
      );

      const suspendido = await usuariosService.suspenderUsuario({
        idUser: 15,
        idAdminGlobal: 1,
        motivo: 'Fraude comprobado',
      });

      expect(suspendido.active).toBe(false);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('No se pudo enviar el correo de suspensión'),
      );

      loggerSpy.mockRestore();
    });

    it('si MailPort.sendMail rechaza la promesa (throw) al suspender usuario, captura el error en Logger y la suspensión termina con éxito', async () => {
      mailPort.sendMail.mockRejectedValue(new Error('Brevo SMTP Timeout'));
      const loggerSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(
        listener.onUsuarioSuspendido({
          idUser: 15,
          name: 'Carlos',
          lastName: 'Ramírez',
          email: 'carlos@tandea.com',
          motivo: 'Cuenta comprometida',
        }),
      ).resolves.toBeUndefined();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Brevo SMTP Timeout'),
      );

      loggerSpy.mockRestore();
    });

    it('si MailPort.sendMail retorna false o rechaza la promesa al resolver disputa, registra el error en Logger y la resolución termina con éxito', async () => {
      mailPort.sendMail.mockRejectedValue(new Error('Proveedor de correo caído'));
      const loggerSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      const repoDisputas: Partial<AdminDisputasRepositoryPort> = {
        obtenerPorId: vi.fn().mockResolvedValue(crearDisputaEjemplo()),
        resolverConAuditoria: vi.fn().mockResolvedValue({
          ...crearDisputaEjemplo(),
          status: 'RESUELTA',
          idResolver: 1,
          resolutionNotes: 'Se revierte el pago a pendiente',
        }),
      };

      const disputasService = new AdminDisputasService(
        repoDisputas as AdminDisputasRepositoryPort,
        eventsAdapter,
      );

      const resuelta = await disputasService.resolverDisputa({
        idDispute: 10,
        idAdminGlobal: 1,
        accion: 'revertir',
        notas: 'Se revierte el pago a pendiente',
      });

      expect(resuelta.status).toBe('RESUELTA');
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Proveedor de correo caído'),
      );

      // También verificamos cuando sendMail retorna false sin lanzar excepción
      loggerSpy.mockClear();
      mailPort.sendMail.mockResolvedValue(false);

      await expect(
        listener.onDisputaResuelta({
          idDispute: 10,
          idTanda: 3,
          nombreTanda: 'Tanda Oficina',
          emailReporter: 'ana@tandea.com',
          nombreReporter: 'Ana López',
          accion: 'suspender',
          notas: 'Tanda suspendida por irregularidades',
        }),
      ).resolves.toBeUndefined();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('No se pudo enviar el correo de disputa resuelta'),
      );

      loggerSpy.mockRestore();
    });
  });
});
