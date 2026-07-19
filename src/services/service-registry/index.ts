import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

interface ServiceInfo {
  name: string;
  host: string;
  port: number;
  lastHeartbeat: number;
}

const services = new Map<string, ServiceInfo>();

// Clean up dead services every 10 seconds
setInterval(() => {
  const now = Date.now();
  for (const [name, info] of services.entries()) {
    if (now - info.lastHeartbeat > 15000) {
      console.log(`[Registry] Service ${name} is dead. Removing...`);
      services.delete(name);
    }
  }
}, 10000);

app.post('/register', (req: Request, res: Response) => {
  const { name, host, port } = req.body;
  if (!name || !host || !port) {
    return res.status(400).json({ error: 'Missing service info' });
  }

  services.set(name, {
    name,
    host,
    port,
    lastHeartbeat: Date.now()
  });

  console.log(`[Registry] Registered/Heartbeat: ${name} at ${host}:${port}`);
  res.json({ message: 'Registered successfully' });
});

app.get('/services', (req: Request, res: Response) => {
  res.json(Array.from(services.values()));
});

app.get('/services/:name', (req: Request, res: Response) => {
  const name = String(req.params.name);
  const service = services.get(name);
  if (service) {
    res.json(service);
  } else {
    res.status(404).json({ error: 'Service not found' });
  }
});

const PORT = process.env.REGISTRY_PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n======================================`);
  console.log(`🚀 Service Registry running on port ${PORT}`);
  console.log(`======================================\n`);
});
