export interface CommandResponse {
  success: boolean;
  message: string;
  photo?: Buffer;
  file?: {
    buffer: Buffer;
    filename: string;
  };
}