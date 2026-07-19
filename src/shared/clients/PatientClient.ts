import axios, { AxiosInstance } from 'axios';
import { PatientDto, PatientBasicDto } from '../dto/PatientDto';

export class PatientClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.PATIENT_SERVICE_URL || 'http://localhost:3003';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async findById(id: string): Promise<PatientDto | null> {
    try {
      const response = await this.client.get<PatientDto>(`/api/patients/${id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async findAll(): Promise<PatientBasicDto[]> {
    try {
      const response = await this.client.get<PatientBasicDto[]>('/api/patients');
      return response.data;
    } catch (error) {
      console.error('[PatientClient] Error fetching patients:', error);
      throw error;
    }
  }

  async count(): Promise<number> {
    try {
      const patients = await this.findAll();
      return patients.length;
    } catch (error) {
      console.error('[PatientClient] Error counting patients:', error);
      throw error;
    }
  }

  async countByStatus(status: string): Promise<number> {
    try {
      const patients = await this.findAll();
      return patients.filter(p => p.status === status).length;
    } catch (error) {
      console.error('[PatientClient] Error counting patients by status:', error);
      throw error;
    }
  }
}
