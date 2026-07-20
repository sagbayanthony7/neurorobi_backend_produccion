const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  console.log('Borrando SpikesLogItem...');
  const spikes = await prisma.spikesLogItem.deleteMany();
  console.log(`  → ${spikes.count} eliminados`);

  console.log('Borrando SensorReading...');
  const sensors = await prisma.sensorReading.deleteMany();
  console.log(`  → ${sensors.count} eliminados`);

  console.log('Borrando ClinicalSession...');
  const sessions = await prisma.clinicalSession.deleteMany();
  console.log(`  → ${sessions.count} eliminados`);

  console.log('Borrando Patient...');
  const patients = await prisma.patient.deleteMany();
  console.log(`  → ${patients.count} eliminados`);

  const specialists = await prisma.specialist.count();
  console.log(`\nSpecialist (credenciales): ${specialists} conservados`);

  await prisma.$disconnect();
  console.log('¡Base de datos limpiada!');
}

main().catch(e => { console.error(e); process.exit(1); });
