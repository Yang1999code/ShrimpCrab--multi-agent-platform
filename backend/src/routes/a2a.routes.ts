import { Router, Response } from 'express';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { getA2AAgentCard, getA2AAgentCards } from '../a2a/a2a-card.service.js';
import { a2aRouter } from '../a2a/a2a-router.service.js';
import { localA2AServer } from '../a2a/a2a-server.service.js';
import type { A2AMessage, A2ATaskEvent } from '../a2a/a2a.types.js';

const router = Router();

router.use(authMiddleware);

router.get('/cards', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ cards: getA2AAgentCards('/api/a2a/cards') });
  } catch (error) {
    console.error('A2A cards error:', error);
    res.status(500).json({ message: '获取 A2A Agent Card 失败' });
  }
});

router.get('/cards/:platform', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const platform = String(req.params.platform);
    res.json({ card: getA2AAgentCard(platform, '/api/a2a/cards') });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Unsupported A2A agent card platform')) {
      res.status(400).json({ message });
      return;
    }
    console.error('A2A card error:', error);
    res.status(500).json({ message: '获取 A2A Agent Card 失败' });
  }
});

router.get('/agents/:agentId/card', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const card = await localA2AServer.getAgentCard(
      req.user!.userId,
      String(req.params.agentId)
    );
    if (!card) {
      res.status(404).json({ message: 'A2A Agent Card not found' });
      return;
    }
    res.json({ card });
  } catch (error) {
    console.error('A2A instance card error:', error);
    res.status(500).json({ message: '获取 Agent A2A Card 失败' });
  }
});

router.post('/agents/:agentId/tasks', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const message = req.body?.message as A2AMessage | undefined;
    if (!message || typeof message !== 'object' || !Array.isArray(message.parts)) {
      res.status(400).json({ message: 'A2A message with parts is required' });
      return;
    }

    const input = {
      userId: req.user!.userId,
      agentId: String(req.params.agentId),
      message,
      contextId: typeof req.body?.contextId === 'string' ? req.body.contextId : undefined,
      timeoutMs: typeof req.body?.timeoutMs === 'number' ? req.body.timeoutMs : undefined,
    };
    if (req.body?.waitForCompletion === false) {
      const task = a2aRouter.startMessage(input);
      res.status(202).json({ task });
      return;
    }

    const task = await a2aRouter.sendMessage(input);
    res.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('text part')) {
      res.status(400).json({ message });
      return;
    }
    console.error('A2A task error:', error);
    res.status(500).json({ message: '执行 A2A task 失败' });
  }
});

router.get('/tasks/:taskId', (req: AuthenticatedRequest, res: Response) => {
  const task = a2aRouter.getTask(req.user!.userId, String(req.params.taskId));
  if (!task) {
    res.status(404).json({ message: 'A2A task not found' });
    return;
  }
  res.json({ task });
});

router.post('/tasks/:taskId/cancel', (req: AuthenticatedRequest, res: Response) => {
  const task = a2aRouter.cancelTask(req.user!.userId, String(req.params.taskId));
  if (!task) {
    res.status(404).json({ message: 'A2A task not found' });
    return;
  }
  res.json({ task });
});

router.get('/tasks/:taskId/events', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const taskId = String(req.params.taskId);
  const task = a2aRouter.getTask(userId, taskId);
  const history = a2aRouter.getTaskEvents(userId, taskId);
  if (!task || !history) {
    res.status(404).json({ message: 'A2A task not found' });
    return;
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  for (const event of history) {
    writeTaskEvent(res, event);
  }
  if (a2aRouter.isTerminal(task)) {
    res.end();
    return;
  }

  const unsubscribe = a2aRouter.subscribeToTask(userId, taskId, (event) => {
    writeTaskEvent(res, event);
    if (a2aRouter.isTerminal(event.task)) {
      unsubscribe?.();
      res.end();
    }
  });
  const heartbeat = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe?.();
  });
});

function writeTaskEvent(res: Response, event: A2ATaskEvent): void {
  res.write(`id: ${event.id}\n`);
  res.write('event: task\n');
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export default router;
