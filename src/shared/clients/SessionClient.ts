import axios, { AxiosInstance } from 'axios';
import { SessionDto, SessionBasicDto, SessionStatsDto } from '../dto/SessionDto';

export class SessionClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.SESSION_SERVICE_URL || 'http://localhost:3004';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async findById(id: string): Promise<SessionDto | null> {
    try {
      const response = await this.client.get<SessionDto>(`/api/sessions/${id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async findByPatientId(patientId: string): Promise<SessionDto[]> {
    try {
      const response = await this.client.get<SessionDto[]>('/api/sessions', {
        params: { patientId }
      });
      return response.data;
    } catch (error) {
      console.error('[SessionClient] Error fetching sessions by patient:', error);
      throw error;
    }
  }

  async findAll(): Promise<SessionDto[]> {
    try {
      const response = await this.client.get<SessionDto[]>('/api/sessions');
      return response.data;
    } catch (error) {
      console.error('[SessionClient] Error fetching sessions:', error);
      throw error;
    }
  }

  async getStats(): Promise<SessionStatsDto> {
    try {
      const sessions = await this.findAll();
      const recentSessions: SessionBasicDto[] = sessions
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
    } catch (error) {
      console.error('[SessionClient] Error getting stats:', error);
      throw error;
    }
  }

  async deleteByPatientId(patientId: string): Promise<void> {
    try {
      const sessions = await this.findByPatientId(patientId);
      for (const session of sessions) {
        await this.client.delete(`/api/sessions/${session.id}`);
      }
    } catch (error) {
      console.error('[SessionClient] Error deleting sessions by patient:', error);
      throw error;
    }
  }
}
