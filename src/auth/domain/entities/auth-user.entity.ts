export class AuthUserEntity {
  constructor(
    public readonly idUser: number,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly name: string,
    public readonly lastName: string,
    public readonly idRole: number,
    public readonly role: string,
    public readonly active: boolean,
  ) {}
}
