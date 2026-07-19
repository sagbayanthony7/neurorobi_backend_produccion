import express from 'express';
import cors from 'cors';
import patientRoutes from '../../routes/patients';
import { registerService } from '../../shared/service-utils';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/uploads', express.static(path.join(__dirname, '../../../../../uploads')));
app.use('/api/patients', patientRoutes);

const PORT = process.env.PATIENT_PORT || 3003;

app.listen(PORT, () => {
  console.log(`[Patient Service] Running on port ${PORT}`);
  registerService('patient-service', Number(PORT));
});
