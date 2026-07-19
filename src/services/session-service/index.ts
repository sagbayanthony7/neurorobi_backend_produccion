import express from 'express';
import cors from 'cors';
import sessionRoutes from '../../routes/sessions';
import { registerService } from '../../shared/service-utils';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/sessions', sessionRoutes);

const PORT = process.env.SESSION_PORT || 3004;

app.listen(PORT, () => {
  console.log(`[Session Service] Running on port ${PORT}`);
  registerService('session-service', Number(PORT));
});
