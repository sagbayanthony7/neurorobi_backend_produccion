import multer from 'multer';
import sharp from 'sharp';

// Use memory storage - no filesystem dependency (Railway ephemeral disk problem)
const memoryStorage = multer.memoryStorage();

export const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|avif|tiff/i;
    const mimeOk = allowed.test(file.mimetype);
    const extOk = allowed.test(require('path').extname(file.originalname).toLowerCase());
    if (mimeOk || extOk) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
    }
  }
});

/**
 * Convert buffer to compressed webp base64 data URI.
 * Returns a string like "data:image/webp;base64,..." that can be stored
 * directly in the database and used as <img src> on the frontend.
 */
async function bufferToWebpDataUri(buffer: Buffer): Promise<string> {
  const webpBuffer = await sharp(buffer)
    .resize(200, 200, { fit: 'cover', withoutEnlargement: true })
    .webp({ quality: 60 })
    .toBuffer();
  return `data:image/webp;base64,${webpBuffer.toString('base64')}`;
}

/**
 * Helper: wraps multer.single() for use in Express 5 async routes.
 * Converts the uploaded image to a webp base64 data URI stored on req.body[fieldName + 'Base64'].
 * The file is NOT saved to disk.
 */
export const handleUpload = (fieldName: string) => {
  return async (req: any, _res: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      upload.single(fieldName)(req, _res, async (err: any) => {
        if (err) {
          reject(err);
        } else {
          if (req.file) {
            try {
              const dataUri = await bufferToWebpDataUri(req.file.buffer);
              // Store the data URI in req.body so routes can read it
              req.body[fieldName + 'DataUri'] = dataUri;
            } catch (error) {
              console.error('[Upload] Error converting to webp:', error);
            }
          }
          resolve();
        }
      });
    });
  };
};
