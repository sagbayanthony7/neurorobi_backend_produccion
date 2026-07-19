import axios, { AxiosInstance } from 'axios';
import { SpecialistDto, SpecialistBasicDto } from '../dto/SpecialistDto';

export class AuthClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async findSpecialistByEmail(email: string): Promise<SpecialistBasicDto | null> {
    try {
      const response = await this.client.get<SpecialistBasicDto>(`/api/auth/specialists/by-email/${encodeURIComponent(email)}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async findSpecialistById(id: string): Promise<SpecialistDto | null> {
    try {
      const response = await this.client.get<SpecialistDto>(`/api/auth/specialists/${id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async findAllSpecialists(): Promise<SpecialistBasicDto[]> {
    try {
      const response = await this.client.get<SpecialistBasicDto[]>('/api/auth/specialists');
      return response.data;
    } catch (error) {
      console.error('[AuthClient] Error fetching specialists:', error);
      throw error;
    }
  }
}
