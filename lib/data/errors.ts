export class DalError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'DalError';
    this.status = status;
  }
}

export const forbidden = (message: string) => new DalError(403, message);
export const badRequest = (message: string) => new DalError(400, message);
export const notFound = (message: string) => new DalError(404, message);
export const conflict = (message: string) => new DalError(409, message);
