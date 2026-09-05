import { v2 as cloudinary } from 'cloudinary';
import { CLOUDINARY_CONFIG } from '../config/env';

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CONFIG.cloud_name,
  api_key: CLOUDINARY_CONFIG.api_key,
  api_secret: CLOUDINARY_CONFIG.api_secret,
  secure: true,
});

export interface UploadResult {
  url: string;
  secure_url: string;
  public_id: string;
  format?: string;
  bytes?: number;
}

export class CloudinaryService {
  /**
   * Uploads an image base64 data URI or remote URL to Cloudinary
   */
  public static async uploadImage(
    dataUriOrUrl: string,
    folder: string = 'agentcart/products'
  ): Promise<UploadResult> {
    if (!CLOUDINARY_CONFIG.cloud_name || !CLOUDINARY_CONFIG.api_key) {
      throw new Error('Cloudinary credentials are not configured.');
    }

    const result = await cloudinary.uploader.upload(dataUriOrUrl, {
      folder,
      resource_type: 'image',
      transformation: [
        { quality: 'auto', fetch_format: 'auto' },
        { width: 1200, crop: 'limit' },
      ],
    });

    return {
      url: result.url,
      secure_url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      bytes: result.bytes,
    };
  }

  /**
   * Checks if Cloudinary is configured
   */
  public static isConfigured(): boolean {
    return Boolean(
      CLOUDINARY_CONFIG.cloud_name &&
      CLOUDINARY_CONFIG.api_key &&
      CLOUDINARY_CONFIG.api_secret
    );
  }
}
