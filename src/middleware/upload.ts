import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.webp');
  }
});

export const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|avif|tiff/i;
    const mimeOk = allowed.test(file.mimetype);
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    if (mimeOk || extOk) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
    }
  }
});

/**
 * Convert uploaded image to .webp format for smaller file size and faster loading.
 * Saves directly to the uploads directory.
 */
export const convertToWebp = async (filePath: string): Promise<string> => {
  const ext = path.extname(filePath);
  if (ext === '.webp') return filePath;

  const webpPath = filePath.replace(ext, '.webp');
  try {
    await sharp(filePath)
      .webp({ quality: 80 })
      .toFile(webpPath);

    // Remove original file if conversion succeeded
    if (fs.existsSync(webpPath) && filePath !== webpPath) {
      fs.unlinkSync(filePath);
    }
    return webpPath;
  } catch (error) {
    console.error('[Upload] Error converting to webp:', error);
    return filePath;
  }
};

/**
 * Helper: wraps multer.single() for use in Express 5 async routes.
 * Also converts the uploaded image to .webp automatically.
 */
export const handleUpload = (fieldName: string) => {
  return async (req: any, res: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      upload.single(fieldName)(req, res, async (err: any) => {
        if (err) {
          reject(err);
        } else {
          // Convert to webp if a file was uploaded
          if (req.file) {
            const originalPath = req.file.path;
            const webpPath = await convertToWebp(originalPath);
            // Update the file info to reflect the webp path
            req.file.path = webpPath;
            req.file.filename = path.basename(webpPath);
          }
          resolve();
        }
      });
    });
  };
};
