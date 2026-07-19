export interface PatientDto {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
  status: string;
  initialObservation: string;
  profileImageUrl?: string | null;
  registeredAt: Date;
}

export interface PatientBasicDto {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
  status: string;
}
