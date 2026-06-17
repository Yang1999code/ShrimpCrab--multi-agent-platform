import { Router, Response } from 'express';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  createProvider,
  getUserProviders,
  getUserProvidersByType,
  updateProvider,
  deleteProvider,
} from '../services/provider.service.js';
import { getRuntimeHealth } from '../services/runtime-health.service.js';
import { getAgentBaseDefinitions, isAgentBaseId } from '../services/agent-base-registry.service.js';
import { getAgentInstallGuide, getAgentInstallGuides } from '../services/agent-install.service.js';

const router = Router();

router.use(authMiddleware);

// GET /api/providers - Get all user providers
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { type } = req.query;
    const provs = type ? await getUserProvidersByType(userId, type as string) : await getUserProviders(userId);
    res.json({ providers: provs });
  } catch (error) {
    console.error('Get providers error:', error);
    res.status(500).json({ message: '获取供应商失败' });
  }
});

// GET /api/providers/runtime-health - Check local CLI and provider readiness
router.get('/runtime-health', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const health = await getRuntimeHealth(req.user!.userId);
    res.json({ health });
  } catch (error) {
    console.error('Runtime health error:', error);
    res.status(500).json({ message: '运行时预检失败' });
  }
});

// GET /api/providers/agent-bases - Built-in agent base registry and install sources
router.get('/agent-bases', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const bases = getAgentBaseDefinitions();
    const installGuides = getAgentInstallGuides(bases.map((base) => base.id));
    res.json({ bases, installGuides });
  } catch (error) {
    console.error('Agent base registry error:', error);
    res.status(500).json({ message: '获取智能体底座列表失败' });
  }
});

// GET /api/providers/agent-bases/:platform/install-guide - Safe install guide for one base
router.get('/agent-bases/:platform/install-guide', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const platform = String(req.params.platform);
    if (!isAgentBaseId(platform)) {
      res.status(400).json({ message: `不支持的智能体底座: ${platform}` });
      return;
    }
    res.json({ guide: getAgentInstallGuide(platform) });
  } catch (error) {
    console.error('Agent install guide error:', error);
    res.status(500).json({ message: '获取安装指引失败' });
  }
});

// GET /api/providers/:id - Get single provider
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const prov = await getUserProviders(userId);
    const found = prov.find(p => p.id === id);
    if (!found) {
      res.status(404).json({ message: '供应商不存在' });
      return;
    }
    res.json({ provider: found });
  } catch (error) {
    console.error('Get provider error:', error);
    res.status(500).json({ message: '获取供应商失败' });
  }
});

// POST /api/providers - Create provider
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, type, apiKey, baseUrl, models } = req.body;
    if (!name || !type || !apiKey) {
      res.status(400).json({ message: '缺少必填字段' });
      return;
    }
    const validTypes = ['claude', 'codex', 'opencode', 'openclaw', 'gemini', 'hermes'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ message: '无效的供应商类型' });
      return;
    }
    const provider = await createProvider(userId, { name, type, apiKey, baseUrl, models });
    res.json({ provider });
  } catch (error) {
    console.error('Create provider error:', error);
    res.status(500).json({ message: '创建供应商失败' });
  }
});

// PATCH /api/providers/:id - Update provider
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const updates = req.body;
    if (updates.type) {
      const validTypes = ['claude', 'codex', 'opencode', 'openclaw', 'gemini', 'hermes'];
      if (!validTypes.includes(updates.type)) {
        res.status(400).json({ message: '无效的供应商类型' });
        return;
      }
    }
    const provider = await updateProvider(id, userId, updates);
    if (!provider) {
      res.status(404).json({ message: '供应商不存在' });
      return;
    }
    res.json({ provider });
  } catch (error) {
    console.error('Update provider error:', error);
    res.status(500).json({ message: '更新供应商失败' });
  }
});

// DELETE /api/providers/:id - Delete provider
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const success = await deleteProvider(id, userId);
    if (!success) {
      res.status(404).json({ message: '供应商不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete provider error:', error);
    res.status(500).json({ message: '删除供应商失败' });
  }
});

export default router;