import { HttpMethod, httpClient } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { taodockAuth } from '../auth';
import { TAODOCK_API_BASE_URL } from '../common/constants';
import { getTaodockResource, taodockHeaders } from '../common/http';
import { normalizeVideoTask, VideoResponse } from '../common/video';

export const downloadVideo = createAction({
  auth: taodockAuth,
  name: 'download_video',
  classification: 'READ',
  displayName: 'Download Video',
  description: 'Downloads a completed Taodock video task as an Activepieces file.',
  audience: 'both',
  aiMetadata: {
    description:
      'Downloads the generated video for a completed Taodock task and returns it as an Activepieces file URL. Use Get Video Task Status first when completion is uncertain; this action fails for queued, in-progress, or failed tasks. Read-only and safe to retry.',
    idempotent: true,
  },
  props: {
    taskId: Property.ShortText({
      displayName: 'Task ID',
      description: 'The completed task ID returned by Create Video Task.',
      required: true,
    }),
  },
  async run(context) {
    const task = normalizeVideoTask(
      await getTaodockResource<VideoResponse>({
        apiKey: context.auth.secret_text,
        path: `videos/${encodeURIComponent(context.propsValue.taskId)}`,
      }),
    );
    if (task.status !== 'completed') {
      const detail = task.error?.message ? ` ${task.error.message}` : '';
      throw new Error(`Video task ${task.id} is ${task.status}.${detail}`);
    }
    const response = await httpClient.sendRequest<ArrayBuffer>({
      method: HttpMethod.GET,
      url: `${TAODOCK_API_BASE_URL}/videos/${encodeURIComponent(task.id)}/content`,
      headers: taodockHeaders(context.auth.secret_text),
      responseType: 'arraybuffer',
      timeout: 600_000,
    });
    const contentType = firstHeader(response.headers?.['content-type']);
    const extension = extensionForMime(contentType);
    const fileName = `${safeFilePart(task.model ?? task.id)}-${safeFilePart(task.id)}.${extension}`;
    const fileUrl = await context.files.write({
      fileName,
      data: Buffer.from(response.body),
    });
    return {
      taskId: task.id,
      model: task.model,
      fileName,
      fileUrl,
      contentType,
    };
  },
});

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function extensionForMime(mimeType: string | undefined): string {
  const normalized = mimeType?.split(';', 1)[0]?.trim().toLowerCase();
  if (normalized === 'video/quicktime') {
    return 'mov';
  }
  if (normalized === 'video/webm') {
    return 'webm';
  }
  return 'mp4';
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'taodock-video';
}
