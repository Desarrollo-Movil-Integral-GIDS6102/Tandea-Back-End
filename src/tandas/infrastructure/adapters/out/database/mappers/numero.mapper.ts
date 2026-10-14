import {
  NumeroTanda,
  NumeroStatus,
} from '../../../../../domain/entities/numero-tanda.entity';

export class NumeroMapper {
  static toDomain(row: any): NumeroTanda {
    return new NumeroTanda({
      idNumber: row.idNumber,
      idTanda: row.idTanda,
      roundNumber: row.roundNumber,
      numberValue: row.numberValue,
      idUser: row.idUser ?? null,
      isDeadNumber: Boolean(row.isDeadNumber),
      status: row.status as NumeroStatus,
      active: row.active ?? true,
      createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
      deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
    });
  }
}
