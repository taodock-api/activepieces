import { createAction, Property } from '@activepieces/pieces-framework';
import { taodockAuth } from '../auth';
import { getTaodockResource } from '../common/http';
import { normalizeVideoTask, VideoResponse } from '../common/video';

export const getVideoStatus = createAction({
  auth: taodockAuth,
  name: 'get_video_status',
  classification: 'READ',
  displayName: 'Get Video Task Status',
  description: 'Returns the current state of a Taodock video generation task.',
  audience: 'both',
  aiMetadata: {
    description:
      'Looks up a Taodock video task by its task ID and returns status, progress, model, and failure details when present. Use after Create Video Task and before Download Video. Read-only and safe to retry.',
    idempotent: true,
  },
  props: {
    taskId: Property.ShortText({
      displayName: 'Task ID',
      description: 'The task ID returned by Create Video Task.',
      required: true,
    }),
  },
  async run(context) {
    const response = await getTaodockResource<VideoResponse>({
      apiKey: context.auth.secret_text,
      path: `videos/${encodeURIComponent(context.propsValue.taskId)}`,
    });
    return normalizeVideoTask(response);
  },
});
