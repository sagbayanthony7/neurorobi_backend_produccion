"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUpload = exports.convertToWebp = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const sharp_1 = __importDefault(require("sharp"));
// Ensure uploads directory exists
const uploadsDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '.webp');
    }
});
exports.upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|avif|tiff/i;
        const mimeOk = allowed.test(file.mimetype);
        const extOk = allowed.test(path_1.default.extname(file.originalname).toLowerCase());
        if (mimeOk || extOk) {
            cb(null, true);
        }
        else {
            cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
        }
    }
});
/**
 * Convert uploaded image to .webp format for smaller file size and faster loading.
 * Saves directly to the uploads directory.
 */
const convertToWebp = async (filePath) => {
    const ext = path_1.default.extname(filePath);
    if (ext === '.webp')
        return filePath;
    const webpPath = filePath.replace(ext, '.webp');
    try {
        await (0, sharp_1.default)(filePath)
            .webp({ quality: 80 })
            .toFile(webpPath);
        // Remove original file if conversion succeeded
        if (fs_1.default.existsSync(webpPath) && filePath !== webpPath) {
            fs_1.default.unlinkSync(filePath);
        }
        return webpPath;
    }
    catch (error) {
        console.error('[Upload] Error converting to webp:', error);
        return filePath;
    }
};
exports.convertToWebp = convertToWebp;
/**
 * Helper: wraps multer.single() for use in Express 5 async routes.
 * Also converts the uploaded image to .webp automatically.
 */
const handleUpload = (fieldName) => {
    return async (req, res) => {
        return new Promise((resolve, reject) => {
            exports.upload.single(fieldName)(req, res, async (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    // Convert to webp if a file was uploaded
                    if (req.file) {
                        const originalPath = req.file.path;
                        const webpPath = await (0, exports.convertToWebp)(originalPath);
                        // Update the file info to reflect the webp path
                        req.file.path = webpPath;
                        req.file.filename = path_1.default.basename(webpPath);
                    }
                    resolve();
                }
            });
        });
    };
};
exports.handleUpload = handleUpload;
//# sourceMappingURL=upload.js.map