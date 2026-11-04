export interface Logger {
  info(obj: object, message: string): void;
  warn(obj: object, message: string): void;
}
