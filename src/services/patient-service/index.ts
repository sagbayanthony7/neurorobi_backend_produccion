import express from 'express';
import cors from 'cors';
import patientRoutes from '../../routes/patients';
import { registerService } from '../../shared/service-utils';
import { prisma } from '../../shared/db';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/patients', patientRoutes);

const PORT = process.env.PATIENT_PORT || 3003;

app.listen(PORT, async () => {
  console.log(`[Patient Service] Running on port ${PORT}`);
  registerService('patient-service', Number(PORT));

  // Clear broken /uploads/ image URLs (filesystem is ephemeral on Railway)
  try {
    const result = await prisma.patient.updateMany({
      where: { profileImageUrl: { startsWith: '/uploads/' } },
      data: { profileImageUrl: null }
    });
    if (result.count > 0) {
      console.log(`[Patient Service] Cleared ${result.count} broken /uploads/ image URLs`);
    }
  } catch (error) {
    console.error('[Patient Service] Error clearing broken image URLs:', error);
  }
});
