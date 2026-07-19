import axios from 'axios';

export function registerService(name: string, port: number) {
  const REGISTRY_URL = process.env.REGISTRY_URL || 'http://localhost:4000/register';
  const HOSTNAME = process.env.HOSTNAME || 'localhost';

  const register = () => {
    axios.post(REGISTRY_URL, {
      name,
      host: HOSTNAME,
      port
    }).catch(() => {
      console.log(`[${name}] Could not reach Registry at ${REGISTRY_URL}. Retrying...`);
    });
  };

  // Register immediately and then every 10 seconds
  register();
  setInterval(register, 10000);
}
