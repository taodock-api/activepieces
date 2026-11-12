import { PieceAuth } from '@activepieces/pieces-framework';
import { getTaodockResource } from './common/http';

export const taodockAuth = PieceAuth.SecretText({
  displayName: 'API Key',
  description:
    'Create a key at https://taodock.com/keys and enable the models your flows need. The key is sent only to https://taodock.com/v1.',
  required: true,
  validate: async ({ auth }) => {
    try {
      await getTaodockResource({
        apiKey: auth,
        path: 'models?scope=authorized',
      });
      return { valid: true };
    } catch {
      return { valid: false, error: 'Could not validate this Taodock API key.' };
    }
  },
});
