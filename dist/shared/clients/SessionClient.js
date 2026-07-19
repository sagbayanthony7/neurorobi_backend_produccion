"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionClient = void 0;
const axios_1 = __importDefault(require("axios"));
class SessionClient {
    constructor() {
        this.baseUrl = process.env.SESSION_SERVICE_URL || 'http://localhost:3004';
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
            const response = await this.client.get(`/api/sessions/${id}`);
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response?.status === 404) {
                return null;
            }
            throw error;
        }
    }
    async findByPatientId(patientId) {
        try {
            const response = await this.client.get('/api/sessions', {
                params: { patientId }
            });
            return response.data;
        }
        catch (error) {
            console.error('[SessionClient] Error fetching sessions by patient:', error);
            throw error;
        }
    }
    async findAll() {
        try {
            const response = await this.client.get('/api/sessions');
            return response.data;
        }
        catch (error) {
            console.error('[SessionClient] Error fetching sessions:', error);
            throw error;
        }
    }
    async getStats() {
        try {
            const sessions = await this.findAll();
            const recentSessions = sessions
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map(s => ({
                id: s.id,
                patientName: s.patientName,
                date: s.date,
                durationSeconds: s.durationSeconds,
                specialistRole: s.specialistRole,
                deviceType: s.deviceType
            }));
            return {
                totalSessions: sessions.length,
                recentSessions
            };
        }
        catch (error) {
            console.error('[SessionClient] Error getting stats:', error);
            throw error;
        }
    }
    async deleteByPatientId(patientId) {
        try {
            const sessions = await this.findByPatientId(patientId);
            for (const session of sessions) {
                await this.client.delete(`/api/sessions/${session.id}`);
            }
        }
        catch (error) {
            console.error('[SessionClient] Error deleting sessions by patient:', error);
            throw error;
        }
    }
}
exports.SessionClient = SessionClient;
//# sourceMappingURL=SessionClient.js.map