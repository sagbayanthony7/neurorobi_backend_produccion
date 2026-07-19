import { Router, Request, Response } from 'express';
import { prisma } from '../shared/db';
import { handleUpload } from '../middleware/upload';
import { SessionClient } from '../shared/clients/SessionClient';

const router = Router();
const sessionClient = new SessionClient();

// ──────────────────────────────────────────
// GET /api/patients  → List all patients
// ──────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const patients = await prisma.patient.findMany({
      orderBy: { registeredAt: 'desc' },
      include: {
        _count: { select: { sessions: true } }
      }
    });
    res.json(patients);
  } catch (error) {
    console.error('[GET /patients]', error);
    res.status(500).json({ error: 'Error al obtener pacientes' });
  }
});

// ──────────────────────────────────────────
// GET /api/patients/:id  → Single patient + sessions
// ──────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        sessions: {
          select: {
            id: true,
            date: true,
            durationSeconds: true,
            specialistRole: true,
            notes: true
          },
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!patient) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }

    res.json(patient);
  } catch (error) {
    console.error('[GET /patients/:id]', error);
    res.status(500).json({ error: 'Error al obtener paciente' });
  }
});

// ──────────────────────────────────────────
// POST /api/patients  → Register new patient
// ──────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    await handleUpload('profileImage')(req, res);

    const { name, age, diagnosis, initialObservation } = req.body as {
      name?: string;
      age?: number | string;
      diagnosis?: string;
      initialObservation?: string;
    };

    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ error: 'El nombre del paciente es requerido' });
      return;
    }
    if (!age || isNaN(Number(age)) || Number(age) <= 0 || Number(age) > 120) {
      res.status(400).json({ error: 'La edad debe ser un número válido entre 1 y 120' });
      return;
    }
    if (!diagnosis || typeof diagnosis !== 'string' || diagnosis.trim() === '') {
      res.status(400).json({ error: 'El diagnóstico es requerido' });
      return;
    }

    const profileImageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const newPatient = await prisma.patient.create({
      data: {
        name: name.trim(),
        age: Number(age),
        diagnosis: diagnosis.trim(),
        initialObservation: initialObservation?.trim() ?? '',
        status: 'Listo para Consulta',
        profileImageUrl
      }
    });

    res.status(201).json(newPatient);
  } catch (error) {
    console.error('[POST /patients]', error);
    res.status(500).json({ error: 'Error al registrar paciente' });
  }
});

// ──────────────────────────────────────────
// PUT /api/patients/:id  → Update full patient data
// ──────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response) => {
  try {
    await handleUpload('profileImage')(req, res);

    const id = String(req.params['id']);
    const { name, age, diagnosis, initialObservation } = req.body as {
      name?: string;
      age?: number | string;
      diagnosis?: string;
      initialObservation?: string;
    };

    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }

    const profileImageUrl = req.file ? `/uploads/${req.file.filename}` : existing.profileImageUrl;

    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(age ? { age: Number(age) } : {}),
        ...(diagnosis ? { diagnosis: diagnosis.trim() } : {}),
        ...(initialObservation !== undefined ? { initialObservation: initialObservation.trim() } : {}),
        profileImageUrl
      }
    });

    res.json(updatedPatient);
  } catch (error) {
    console.error('[PUT /patients/:id]', error);
    res.status(500).json({ error: 'Error al actualizar paciente' });
  }
});

// ──────────────────────────────────────────
// PUT /api/patients/:id/status  → Update status only
// ──────────────────────────────────────────
router.put('/:id/status', async (req: Request, res: Response) => {
  const VALID_STATUSES = ['Listo para Consulta', 'En Sesión', 'Sesión Completada'];

  try {
    const id = String(req.params['id']);
    const { status } = req.body as { status?: string };

    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({
        error: `Estado inválido. Debe ser uno de: ${VALID_STATUSES.join(', ')}`
      });
      return;
    }

    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }

    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: { status }
    });

    res.json(updatedPatient);
  } catch (error) {
    console.error('[PUT /patients/:id/status]', error);
    res.status(500).json({ error: 'Error al actualizar estado del paciente' });
  }
});

// ──────────────────────────────────────────
// DELETE /api/patients/:id  → Delete patient + all sessions
// ──────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);

    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }

    // Using Feign Client to delete sessions from Session Service
    // This maintains separation of concerns - Patient Service doesn't touch Session tables
    await sessionClient.deleteByPatientId(id);
    
    await prisma.patient.delete({ where: { id } });

    res.json({ message: 'Paciente y todas sus sesiones eliminados correctamente', id });
  } catch (error) {
    console.error('[DELETE /patients/:id]', error);
    res.status(500).json({ error: 'Error al eliminar paciente' });
  }
});

export default router;
