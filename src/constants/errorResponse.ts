import { CustomError } from "../types/error.types";

export class ErrorResponse extends Error implements CustomError {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    // Restore prototype chain (required when targeting ES5/extending built-ins).
    Object.setPrototypeOf(this, ErrorResponse.prototype);
  }
}
