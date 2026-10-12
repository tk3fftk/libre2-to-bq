export class CollectorError extends Error {
  constructor(code) {
    super(code);
    this.name = 'CollectorError';
  }
}

export function fail(code) {
  throw new CollectorError(code);
}
