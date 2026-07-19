export interface SessionDto {
  id: string;
  patientId: string;
  patientName: string;
  date: Date;
  durationSeconds: number;
  specialistRole: string;
  specialistId: string;
  notes: string;
  deviceType: 'PULSERA' | 'OSO';
  metrics: {
    avgHeartRate: number;
    maxHeartRate: number;
    minHeartRate: number;
    avgHugForce: number;
    maxHugForce: number;
    comfortIndex: number;
    bilateralSync: number;
    motorFatigueScore: number;
    stereotypicalCount: number;
    calmStatePercentage: number;
    spikesCount: number;
  };
}

export interface SessionBasicDto {
  id: string;
  patientName: string;
  date: Date;
  durationSeconds: number;
  specialistRole: string;
  deviceType: 'PULSERA' | 'OSO';
}

export interface SessionStatsDto {
  totalSessions: number;
  recentSessions: SessionBasicDto[];
}
