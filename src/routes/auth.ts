import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../shared/db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env['JWT_SECRET'] || 'neurorobi-secret-key-2026';

// ──────────────────────────────────────────
// POST /api/auth/register  → Register new specialist
// ──────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, role, profileImageBase64 } = req.body as {
      email?: string;
      password?: string;
      name?: string;
      role?: string;
      profileImageBase64?: string;
    };

    if (!email || !password || !name || !role) {
      res.status(400).json({ error: 'Todos los campos son obligatorios' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await prisma.specialist.findUnique({
      where: { email: cleanEmail }
    });

    if (existing) {
      res.status(400).json({ error: 'El correo electrónico ya está registrado' });
      return;
    }

    // Validate role
    const validRoles = ['PSICOLOGIA_CLINICA', 'EDUCACION_ESPECIAL', 'FISIOTERAPIA', 'ADMIN'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Rol inválido especificado' });
      return;
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    const newSpecialist = await prisma.specialist.create({
      data: {
        email: cleanEmail,
        password: hashedPassword,
        name: name.trim(),
        role: role as any,
        profileImageUrl: profileImageBase64 || null
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profileImageUrl: true,
        createdAt: true
      }
    });

    res.status(201).json(newSpecialist);
  } catch (error) {
    console.error('[POST /auth/register]', error);
    res.status(500).json({ error: 'Error al registrar especialista' });
  }
});

// ──────────────────────────────────────────
// POST /api/auth/login  → Authenticate & issue token
// ──────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: 'Correo y contraseña son requeridos' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();

    // Find specialist
    const specialist = await prisma.specialist.findUnique({
      where: { email: cleanEmail }
    });

    if (!specialist) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    // Compare passwords
    const isPasswordValid = bcrypt.compareSync(password, specialist.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: specialist.id,
        email: specialist.email,
        name: specialist.name,
        role: specialist.role
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: specialist.id,
        email: specialist.email,
        name: specialist.name,
        role: specialist.role,
        profileImageUrl: specialist.profileImageUrl
      }
    });
  } catch (error) {
    console.error('[POST /auth/login]', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// ──────────────────────────────────────────
// PUT /api/auth/profile/:id  → Update specialist profile
// ──────────────────────────────────────────
router.put('/profile/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const { name, password, profileImageBase64 } = req.body as {
      name?: string;
      password?: string;
      profileImageBase64?: string;
    };

    const existing = await prisma.specialist.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Especialista no encontrado' });
      return;
    }

    const dataToUpdate: any = {};
    if (name && name.trim() !== '') dataToUpdate.name = name.trim();
    if (password && password.trim() !== '') {
      dataToUpdate.password = bcrypt.hashSync(password, 10);
    }
    if (profileImageBase64) {
      dataToUpdate.profileImageUrl = profileImageBase64;
    }

    const updated = await prisma.specialist.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profileImageUrl: true
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('[PUT /auth/profile]', error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// ──────────────────────────────────────────
// GET /api/auth/specialists  → List all specialists
// ──────────────────────────────────────────
router.get('/specialists', async (_req: Request, res: Response) => {
  try {
    const specialists = await prisma.specialist.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });
    res.json(specialists);
  } catch (error) {
    console.error('[GET /auth/specialists]', error);
    res.status(500).json({ error: 'Error al obtener especialistas' });
  }
});

// ──────────────────────────────────────────
// GET /api/auth/specialists/by-email/:email
// ──────────────────────────────────────────
router.get('/specialists/by-email/:email', authenticate, async (req: Request, res: Response) => {
  try {
    const email = String(req.params['email']).toLowerCase().trim();
    const specialist = await prisma.specialist.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    if (!specialist) {
      res.status(404).json({ error: 'Especialista no encontrado' });
      return;
    }

    res.json(specialist);
  } catch (error) {
    console.error('[GET /auth/specialists/by-email]', error);
    res.status(500).json({ error: 'Error al obtener especialista' });
  }
});

// ──────────────────────────────────────────
// GET /api/auth/specialists/:id
// ──────────────────────────────────────────
router.get('/specialists/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const specialist = await prisma.specialist.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profileImageUrl: true,
        createdAt: true
      }
    });

    if (!specialist) {
      res.status(404).json({ error: 'Especialista no encontrado' });
      return;
    }

    res.json(specialist);
  } catch (error) {
    console.error('[GET /auth/specialists/:id]', error);
    res.status(500).json({ error: 'Error al obtener especialista' });
  }
});

// ──────────────────────────────────────────
// PUT /api/auth/specialists/:id  → Admin: update specialist
// ──────────────────────────────────────────
router.put('/specialists/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params['id']);
    const { name, email, role, password } = req.body as {
      name?: string;
      email?: string;
      role?: string;
      password?: string;
    };

    const existing = await prisma.specialist.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Especialista no encontrado' });
      return;
    }

    const dataToUpdate: any = {};
    if (name && name.trim() !== '') dataToUpdate.name = name.trim();
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      if (cleanEmail !== existing.email) {
        const emailTaken = await prisma.specialist.findUnique({ where: { email: cleanEmail } });
        if (emailTaken) {
          res.status(400).json({ error: 'El correo electrónico ya está en uso' });
          return;
        }
        dataToUpdate.email = cleanEmail;
      }
    }
    if (role) {
      const validRoles = ['PSICOLOGIA_CLINICA', 'EDUCACION_ESPECIAL', 'FISIOTERAPIA', 'ADMIN'];
      if (!validRoles.includes(role)) {
        res.status(400).json({ error: 'Rol inválido' });
        return;
      }
      dataToUpdate.role = role;
    }
    if (password && password.trim() !== '') {
      dataToUpdate.password = bcrypt.hashSync(password, 10);
    }

    const updated = await prisma.specialist.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profileImageUrl: true,
        createdAt: true
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('[PUT /auth/specialists/:id]', error);
    res.status(500).json({ error: 'Error al actualizar especialista' });
  }
});

// ──────────────────────────────────────────
// DELETE /api/auth/specialists/:id  → Admin: delete specialist
// ──────────────────────────────────────────
router.delete('/specialists/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params['id']);

    const existing = await prisma.specialist.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Especialista no encontrado' });
      return;
    }

    if (existing.role === 'ADMIN') {
      const adminCount = await prisma.specialist.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        res.status(400).json({ error: 'No se puede eliminar el último administrador' });
        return;
      }
    }

    await prisma.patientAssignment.deleteMany({ where: { specialistId: id } });
    await prisma.specialist.delete({ where: { id } });

    res.json({ message: 'Especialista eliminado correctamente', id });
  } catch (error) {
    console.error('[DELETE /auth/specialists/:id]', error);
    res.status(500).json({ error: 'Error al eliminar especialista' });
  }
});

// ──────────────────────────────────────────
// GET /api/auth/specialists/:id/stats  → Admin: get specialist stats
// ──────────────────────────────────────────
router.get('/specialists/:id/stats', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params['id']);

    const specialist = await prisma.specialist.findUnique({ where: { id } });
    if (!specialist) {
      res.status(404).json({ error: 'Especialista no encontrado' });
      return;
    }

    const assignmentCount = await prisma.patientAssignment.count({ where: { specialistId: id } });
    const sessionCount = await prisma.clinicalSession.count({ where: { specialistId: id } });

    res.json({
      specialistId: id,
      name: specialist.name,
      email: specialist.email,
      role: specialist.role,
      assignedPatients: assignmentCount,
      totalSessions: sessionCount
    });
  } catch (error) {
    console.error('[GET /auth/specialists/:id/stats]', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// ──────────────────────────────────────────
// Database Seeder
// ──────────────────────────────────────────
export async function seedInitialUser() {
  try {
    await prisma.specialist.updateMany({
      where: { profileImageUrl: { startsWith: '/uploads/' } },
      data: { profileImageUrl: null }
    });
    await prisma.patient.updateMany({
      where: { profileImageUrl: { startsWith: '/uploads/' } },
      data: { profileImageUrl: null }
    });

    const usersToSeed = [
      { email: 'accionsocial@gmail.com', password: 'accionsocialcuenca', name: 'Acción Social Admin', role: 'ADMIN' as const }
    ];

    for (const user of usersToSeed) {
      const existing = await prisma.specialist.findUnique({
        where: { email: user.email }
      });

      const hashedPassword = bcrypt.hashSync(user.password, 10);

      if (!existing) {
        await prisma.specialist.create({
          data: {
            email: user.email,
            password: hashedPassword,
            name: user.name,
            role: user.role
          }
        });
        console.log(`✅ Seeded user: ${user.name} (${user.role})`);
      } else {
        if (existing.password !== hashedPassword) {
          await prisma.specialist.update({
            where: { email: user.email },
            data: { password: hashedPassword }
          });
          console.log(`🔄 Updated password for: ${user.email}`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error during user seeding:', error);
  }
}

export default router;
