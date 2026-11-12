export type VideoResponse = {
  id?: string;
  task_id?: string;
  status?: string;
  model?: string;
  progress?: number;
  error?: { message?: string; code?: string } | null;
};

export function normalizeVideoTask(body: VideoResponse): VideoTask {
  const id = body.id || body.task_id;
  if (!id) {
    throw new Error('Taodock returned a video task without an ID.');
  }
  return {
    id,
    status: body.status ?? 'queued',
    ...(body.model ? { model: body.model } : {}),
    ...(typeof body.progress === 'number' ? { progress: body.progress } : {}),
    ...(body.error ? { error: body.error } : {}),
  };
}

type VideoTask = {
  id: string;
  status: string;
  model?: string;
  progress?: number;
  error?: { message?: string; code?: string };
};
