import { Property } from '@activepieces/pieces-framework';
import { taodockAuth } from '../auth';
import { getModels, ModelKind } from './models';

export const imageModelProp = modelDropdown({
  displayName: 'Image Model',
  description: 'An image model authorized for this Taodock API key.',
  kind: 'image',
});

export const videoModelProp = modelDropdown({
  displayName: 'Video Model',
  description: 'A video model authorized for this Taodock API key.',
  kind: 'video',
});

function modelDropdown({ displayName, description, kind }: ModelDropdownParams) {
  return Property.Dropdown({
    auth: taodockAuth,
    displayName,
    description,
    required: true,
    refreshers: [],
    options: async ({ auth }) => {
      if (!auth) {
        return {
          disabled: true,
          placeholder: 'Connect your Taodock API key first.',
          options: [],
        };
      }
      try {
        const models = (await getModels(auth.secret_text)).filter((model) => model.kind === kind);
        return {
          disabled: models.length === 0,
          placeholder: models.length === 0 ? `No authorized ${kind} models found.` : undefined,
          options: models.map((model) => ({ label: model.id, value: model.id })),
        };
      } catch {
        return {
          disabled: true,
          placeholder: 'Could not load models. Check the API key and try again.',
          options: [],
        };
      }
    },
  });
}

type ModelDropdownParams = {
  displayName: string;
  description: string;
  kind: ModelKind;
};
