'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelA2ATask,
  fetchA2AInstanceAgentCard,
  fetchA2ATask,
  startA2ATask,
} from '@/lib/api';
import type { A2AAgentCard, A2ATask } from '@/types';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelInput } from '@/components/ui/PixelInput';

const TERMINAL_STATES = new Set(['completed', 'failed', 'canceled']);

export function A2AAgentPanel({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [card, setCard] = useState<A2AAgentCard | null>(null);
  const [task, setTask] = useState<A2ATask | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loadingCard, setLoadingCard] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const pollingTaskId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingCard(true);
    fetchA2AInstanceAgentCard(agentId)
      .then((nextCard) => {
        if (active) setCard(nextCard);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : '读取 A2A Card 失败');
      })
      .finally(() => {
        if (active) setLoadingCard(false);
      });
    return () => {
      active = false;
      pollingTaskId.current = null;
    };
  }, [agentId]);

  const outputText = useMemo(() => {
    return task?.status.message?.parts
      .filter((part) => part.kind === 'text')
      .map((part) => part.text)
      .join('\n\n') || '';
  }, [task]);

  const pollTask = async (taskId: string) => {
    pollingTaskId.current = taskId;
    for (let attempt = 0; attempt < 600 && pollingTaskId.current === taskId; attempt += 1) {
      const current = await fetchA2ATask(taskId);
      setTask(current);
      if (TERMINAL_STATES.has(current.status.state)) return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  };

  const submit = async () => {
    const text = prompt.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const started = await startA2ATask(
        agentId,
        { role: 'user', parts: [{ kind: 'text', text }] },
        { waitForCompletion: false }
      );
      setTask(started);
      setPrompt('');
      await pollTask(started.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'A2A 任务执行失败');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    if (!task || TERMINAL_STATES.has(task.status.state)) return;
    setError('');
    try {
      pollingTaskId.current = null;
      setTask(await cancelA2ATask(task.id));
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : '取消 A2A 任务失败');
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 p-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
      <section className="border-4 border-pixel-black bg-pixel-white p-4" style={{ boxShadow: '5px 5px 0 #101010' }}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-pixel text-lg font-bold text-pixel-black">A2A Agent Card</h2>
          <span className="border-2 border-pixel-black bg-pixel-green px-2 py-1 font-pixel text-xs text-pixel-white">JWT</span>
        </div>
        {loadingCard && <p className="mt-4 font-pixel text-sm text-pixel-black/60">读取中...</p>}
        {card && (
          <div className="mt-4 space-y-3 font-pixel text-sm text-pixel-black">
            <div>
              <p className="font-bold">{card.name}</p>
              <p className="mt-1 break-words text-xs text-pixel-black/60">{card.description || agentName}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="border-2 border-pixel-black p-2">版本 {card.version}</span>
              <span className="border-2 border-pixel-black p-2">平台 {String(card.metadata?.platform || 'unknown')}</span>
            </div>
            <div>
              <p className="mb-2 font-bold">Skills（技能）</p>
              <div className="flex flex-wrap gap-2">
                {card.skills.map((skill) => (
                  <span key={skill.id} className="border-2 border-pixel-black bg-pixel-yellow px-2 py-1 text-xs">
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>
            <p className="break-all border-2 border-pixel-black bg-pixel-black/5 p-2 text-xs">{card.url}</p>
          </div>
        )}
      </section>

      <section className="border-4 border-pixel-black bg-pixel-white p-4" style={{ boxShadow: '5px 5px 0 #101010' }}>
        <h2 className="font-pixel text-lg font-bold text-pixel-black">A2A Task（任务）</h2>
        <div className="mt-4 grid gap-3">
          <PixelInput
            value={prompt}
            onChange={setPrompt}
            multiline
            rows={4}
            disabled={submitting}
            placeholder={`通过 A2A 给「${agentName}」派发任务`}
          />
          <div className="flex flex-wrap gap-2">
            <PixelButton onClick={() => void submit()} disabled={submitting || !prompt.trim()}>
              {submitting ? '任务执行中' : '发送 A2A 任务'}
            </PixelButton>
            {task && !TERMINAL_STATES.has(task.status.state) && (
              <PixelButton variant="danger" onClick={() => void cancel()}>
                取消任务
              </PixelButton>
            )}
          </div>
        </div>

        {error && <p className="mt-4 border-2 border-pixel-red bg-pixel-white p-3 font-pixel text-sm text-pixel-red">{error}</p>}
        {task && (
          <div className="mt-4 space-y-3 font-pixel text-sm text-pixel-black">
            <div className="flex flex-wrap items-center justify-between gap-2 border-2 border-pixel-black p-3">
              <span className="break-all text-xs">{task.id}</span>
              <span className="border-2 border-pixel-black bg-pixel-yellow px-2 py-1 text-xs">{task.status.state}</span>
            </div>
            {outputText && (
              <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words border-2 border-pixel-black bg-pixel-black/5 p-3 text-xs leading-relaxed">
                {outputText}
              </pre>
            )}
            {task.artifacts.length > 0 && (
              <div className="border-2 border-pixel-black p-3">
                <p className="font-bold">Artifacts（产物）</p>
                {task.artifacts.map((artifact) => (
                  <p key={artifact.id} className="mt-2 break-all text-xs">{artifact.name}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
