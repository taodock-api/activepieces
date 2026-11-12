import { createAction, Property } from '@activepieces/pieces-framework';
import { taodockAuth } from '../auth';
import { TAODOCK_MODEL_GUIDE_URL } from '../common/constants';
import { getModels } from '../common/models';

export const listModels = createAction({
  auth: taodockAuth,
  name: 'list_models',
  classification: 'SEARCH',
  displayName: 'List Models',
  description: 'Lists models available to the connected Taodock API key.',
  audience: 'both',
  aiMetadata: {
    description:
      'Lists model IDs authorized for the connected Taodock key, optionally filtered by capability. Use before generation when a model ID is unknown or availability may have changed. Read-only and safe to retry.',
    idempotent: true,
  },
  props: {
    kind: Property.StaticDropdown({
      displayName: 'Capability',
      description: 'Only return models with this capability. Leave empty to return every recognized model.',
      required: false,
      options: {
        options: [
          { label: 'Text', value: 'text' },
          { label: 'Image', value: 'image' },
          { label: 'Video', value: 'video' },
          { label: 'Embedding', value: 'embedding' },
          { label: 'Rerank', value: 'rerank' },
        ],
      },
    }),
  },
  async run(context) {
    const models = await getModels(context.auth.secret_text);
    const filtered = context.propsValue.kind
      ? models.filter((model) => model.kind === context.propsValue.kind)
      : models;
    return {
      count: filtered.length,
      models: filtered,
      guide: TAODOCK_MODEL_GUIDE_URL,
    };
  },
});
