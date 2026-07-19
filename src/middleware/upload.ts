import multer from 'multer';
import path from 'path';
import fs from 'fs';

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
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/i;
    const mimeOk = allowed.test(file.mimetype);
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    if (mimeOk && extOk) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
    }
  }
});

/**
 * Helper: wraps multer.single() for use in Express 5 async routes.
 * In Express 5, middleware must be called manually inside async handlers
 * or used via the traditional callback style.
 */
export const handleUpload = (fieldName: string) => {
  return (req: any, res: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      upload.single(fieldName)(req, res, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };
};
