"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUpload = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const sharp_1 = __importDefault(require("sharp"));
// Use memory storage - no filesystem dependency (Railway ephemeral disk problem)
const memoryStorage = multer_1.default.memoryStorage();
exports.upload = (0, multer_1.default)({
    storage: memoryStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|avif|tiff/i;
        const mimeOk = allowed.test(file.mimetype);
        const extOk = allowed.test(require('path').extname(file.originalname).toLowerCase());
        if (mimeOk || extOk) {
            cb(null, true);
        }
        else {
            cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
        }
    }
});
/**
 * Convert buffer to compressed webp base64 data URI.
 * Returns a string like "data:image/webp;base64,..." that can be stored
 * directly in the database and used as <img src> on the frontend.
 */
async function bufferToWebpDataUri(buffer) {
    const webpBuffer = await (0, sharp_1.default)(buffer)
        .resize(400, 400, { fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    return `data:image/webp;base64,${webpBuffer.toString('base64')}`;
}
/**
 * Helper: wraps multer.single() for use in Express 5 async routes.
 * Converts the uploaded image to a webp base64 data URI stored on req.body[fieldName + 'Base64'].
 * The file is NOT saved to disk.
 */
const handleUpload = (fieldName) => {
    return async (req, _res) => {
        return new Promise((resolve, reject) => {
            exports.upload.single(fieldName)(req, _res, async (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    if (req.file) {
                        try {
                            const dataUri = await bufferToWebpDataUri(req.file.buffer);
                            // Store the data URI in req.body so routes can read it
                            req.body[fieldName + 'DataUri'] = dataUri;
                        }
                        catch (error) {
                            console.error('[Upload] Error converting to webp:', error);
                        }
                    }
                    resolve();
                }
            });
        });
    };
};
exports.handleUpload = handleUpload;
//# sourceMappingURL=upload.js.map