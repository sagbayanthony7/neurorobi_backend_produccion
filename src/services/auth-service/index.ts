import express from 'express';
import cors from 'cors';
import authRoutes, { seedInitialUser } from '../../routes/auth';
import { registerService } from '../../shared/service-utils';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '../../../../../uploads')));
app.use('/api/auth', authRoutes);

const PORT = process.env.AUTH_PORT || 3002;

app.listen(PORT, async () => {
  console.log(`[Auth Service] Running on port ${PORT}`);
  registerService('auth-service', Number(PORT));
  await seedInitialUser();
});
