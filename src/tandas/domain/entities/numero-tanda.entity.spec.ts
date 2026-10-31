import { describe, it, expect } from 'vitest';
import { NumeroTanda } from './numero-tanda.entity';
import {
  NumeroYaTomadoError,
  NumeroMuertoNoElegibleError,
  NumeroFueraDeRangoError,
} from '../errors/numero.errors';

describe('[AP-02] Entidad de Dominio NumeroTanda', () => {
  const baseProps = {
    idTanda: 1,
    roundNumber: 1,
    numberValue: 3,
    idUser: null,
    isDeadNumber: false,
  };

  it('debe instanciar correctamente un número libre', () => {
    const num = new NumeroTanda(baseProps);

    expect(num.idTanda).toBe(1);
    expect(num.roundNumber).toBe(1);
    expect(num.numberValue).toBe(3);
    expect(num.idUser).toBeNull();
    expect(num.isDeadNumber).toBe(false);
    expect(num.status).toBe('PENDIENTE');
    expect(num.active).toBe(true);
  });

  it('debe asignar exitosamente el número a un usuario participante', () => {
    const num = new NumeroTanda(baseProps);

    num.asignarA(42);

    expect(num.idUser).toBe(42);
    expect(num.updatedAt).toBeInstanceOf(Date);
  });

  it('debe lanzar NumeroYaTomadoError si el número ya tiene un dueño asignado', () => {
    const num = new NumeroTanda({
      ...baseProps,
      idUser: 10,
    });

    expect(() => num.asignarA(20)).toThrow(NumeroYaTomadoError);
  });

  it('debe lanzar NumeroMuertoNoElegibleError si el número es el número muerto', () => {
    const num = new NumeroTanda({
      ...baseProps,
      isDeadNumber: true,
      idUser: null,
    });

    expect(() => num.asignarA(20)).toThrow(NumeroMuertoNoElegibleError);
  });

  it('acepta el #0 solo si es el número muerto', () => {
    expect(
      () => new NumeroTanda({ ...baseProps, numberValue: 0, isDeadNumber: true, idUser: null }),
    ).not.toThrow();
    expect(() => new NumeroTanda({ ...baseProps, numberValue: 0 })).toThrow(
      NumeroFueraDeRangoError,
    );
  });

  it('debe lanzar NumeroFueraDeRangoError si numberValue es menor a 1', () => {
    expect(
      () =>
        new NumeroTanda({
          ...baseProps,
          numberValue: 0,
        }),
    ).toThrow(NumeroFueraDeRangoError);
  });

  it('debe lanzar error si roundNumber es menor a 1', () => {
    expect(
      () =>
        new NumeroTanda({
          ...baseProps,
          roundNumber: 0,
        }),
    ).toThrow('El número de vuelta debe ser mayor o igual a 1');
  });

  it('debe lanzar error si se intenta asignar a un idUsuario inválido', () => {
    const num = new NumeroTanda(baseProps);

    expect(() => num.asignarA(0)).toThrow('El id de usuario debe ser un número entero positivo.');
    expect(() => num.asignarA(-5)).toThrow('El id de usuario debe ser un número entero positivo.');
  });

  it('debe permitir liberar un número asignado', () => {
    const num = new NumeroTanda({ ...baseProps, idUser: 15 });
    num.liberar();
    expect(num.idUser).toBeNull();
  });
});
