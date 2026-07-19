import express from 'express';
import cors from 'cors';
import authRoutes, { seedInitialUser } from '../../routes/auth';
import { registerService } from '../../shared/service-utils';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);

const PORT = process.env.AUTH_PORT || 3002;

app.listen(PORT, async () => {
  console.log(`[Auth Service] Running on port ${PORT}`);
  registerService('auth-service', Number(PORT));
  await seedInitialUser();
});
