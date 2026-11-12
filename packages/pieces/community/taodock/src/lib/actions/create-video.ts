import { HttpMethod, httpClient } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { taodockAuth } from '../auth';
import { TAODOCK_API_BASE_URL } from '../common/constants';
import { taodockHeaders } from '../common/http';
import { findModel } from '../common/models';
import { videoModelProp } from '../common/props';
import { normalizeVideoTask, VideoResponse } from '../common/video';

export const createVideo = createAction({
  auth: taodockAuth,
  name: 'create_video',
  classification: 'WRITE',
  displayName: 'Create Video Task',
  description: 'Starts an asynchronous video generation task with Taodock.',
  audience: 'both',
  aiMetadata: {
    description:
      'Starts an asynchronous video generation task using a video-capable model authorized for the connected Taodock key. Pass the selected model\'s request fields, then use Get Video Task Status and Download Video with the returned task ID. Each call consumes quota and creates a new task, so retries are not idempotent.',
    idempotent: false,
  },
  props: {
    model: videoModelProp,
    request: Property.Json({
      displayName: 'Video Request',
      description:
        'Model-specific video fields from the Taodock model guide, including the prompt and any image, duration, aspect ratio, resolution, or seed supported by the selected model. The model field here is ignored.',
      required: true,
    }),
  },
  async run(context) {
    const model = await findModel({
      apiKey: context.auth.secret_text,
      id: context.propsValue.model,
      kind: 'video',
    });
    const request = Object.fromEntries(
      Object.entries(context.propsValue.request).filter(([key]) => key !== 'model'),
    );
    const response = await httpClient.sendRequest<VideoResponse>({
      method: HttpMethod.POST,
      url: `${TAODOCK_API_BASE_URL}/videos`,
      headers: taodockHeaders(context.auth.secret_text),
      body: { ...request, model: model.id },
    });
    return normalizeVideoTask(response.body);
  },
});
