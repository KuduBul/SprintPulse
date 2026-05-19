import * as QRCode from 'qrcode';

export interface QRService {
  /** Generate a QR code as a PNG data URL for the given poll URL */
  generateQRCode(pollUrl: string): Promise<string>;

  /** Generate a QR code as a PNG buffer for download */
  generateQRCodeBuffer(pollUrl: string): Promise<Buffer>;
}

export function createQRService(): QRService {
  return {
    async generateQRCode(pollUrl: string): Promise<string> {
      const dataUrl = await QRCode.toDataURL(pollUrl, {
        width: 300,
        margin: 2,
        type: 'image/png',
      });
      return dataUrl;
    },

    async generateQRCodeBuffer(pollUrl: string): Promise<Buffer> {
      const buffer = await QRCode.toBuffer(pollUrl, {
        width: 300,
        margin: 2,
        type: 'png',
      });
      return buffer;
    },
  };
}

export const qrService = createQRService();
