"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUpload = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
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
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
exports.upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (_req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/i;
        const mimeOk = allowed.test(file.mimetype);
        const extOk = allowed.test(path_1.default.extname(file.originalname).toLowerCase());
        if (mimeOk && extOk) {
            cb(null, true);
        }
        else {
            cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
        }
    }
});
/**
 * Helper: wraps multer.single() for use in Express 5 async routes.
 * In Express 5, middleware must be called manually inside async handlers
 * or used via the traditional callback style.
 */
const handleUpload = (fieldName) => {
    return (req, res) => {
        return new Promise((resolve, reject) => {
            exports.upload.single(fieldName)(req, res, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    };
};
exports.handleUpload = handleUpload;
//# sourceMappingURL=upload.js.map