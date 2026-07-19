"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthClient = void 0;
const axios_1 = __importDefault(require("axios"));
class AuthClient {
    constructor() {
        this.baseUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
        this.client = axios_1.default.create({
            baseURL: this.baseUrl,
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
    async findSpecialistByEmail(email) {
        try {
            const response = await this.client.get(`/api/auth/specialists/by-email/${encodeURIComponent(email)}`);
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response?.status === 404) {
                return null;
            }
            throw error;
        }
    }
    async findSpecialistById(id) {
        try {
            const response = await this.client.get(`/api/auth/specialists/${id}`);
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response?.status === 404) {
                return null;
            }
            throw error;
        }
    }
    async findAllSpecialists() {
        try {
            const response = await this.client.get('/api/auth/specialists');
            return response.data;
        }
        catch (error) {
            console.error('[AuthClient] Error fetching specialists:', error);
            throw error;
        }
    }
}
exports.AuthClient = AuthClient;
//# sourceMappingURL=AuthClient.js.map