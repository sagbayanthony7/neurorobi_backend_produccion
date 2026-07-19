export interface SpecialistDto {
  id: string;
  email: string;
  name: string;
  role: string;
  profileImageUrl?: string | null;
  createdAt: Date;
}

export interface SpecialistBasicDto {
  id: string;
  email: string;
  name: string;
  role: string;
}
