"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientClient = void 0;
const axios_1 = __importDefault(require("axios"));
class PatientClient {
    constructor() {
        this.baseUrl = process.env.PATIENT_SERVICE_URL || 'http://localhost:3003';
        this.client = axios_1.default.create({
            baseURL: this.baseUrl,
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
    async findById(id) {
        try {
            const response = await this.client.get(`/api/patients/${id}`);
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response?.status === 404) {
                return null;
            }
            throw error;
        }
    }
    async findAll() {
        try {
            const response = await this.client.get('/api/patients');
            return response.data;
        }
        catch (error) {
            console.error('[PatientClient] Error fetching patients:', error);
            throw error;
        }
    }
    async count() {
        try {
            const patients = await this.findAll();
            return patients.length;
        }
        catch (error) {
            console.error('[PatientClient] Error counting patients:', error);
            throw error;
        }
    }
    async countByStatus(status) {
        try {
            const patients = await this.findAll();
            return patients.filter(p => p.status === status).length;
        }
        catch (error) {
            console.error('[PatientClient] Error counting patients by status:', error);
            throw error;
        }
    }
}
exports.PatientClient = PatientClient;
//# sourceMappingURL=PatientClient.js.map