import { createCustomApiCallAction } from '@activepieces/pieces-common';
import { createPiece, PieceCategory } from '@activepieces/pieces-framework';
import { createVideo } from './lib/actions/create-video';
import { downloadVideo } from './lib/actions/download-video';
import { generateImage } from './lib/actions/generate-image';
import { getVideoStatus } from './lib/actions/get-video-status';
import { listModels } from './lib/actions/list-models';
import { taodockAuth } from './lib/auth';
import { TAODOCK_API_BASE_URL, TAODOCK_PLUGIN_HEADER } from './lib/common/constants';

export const taodock = createPiece({
  displayName: 'Taodock',
  description: 'Discover authorized AI models and generate images and videos with Taodock.',
  minimumSupportedRelease: '0.88.2',
  logoUrl: 'https://raw.githubusercontent.com/taodock-api/taodock-mcp/main/assets/icon.png',
  categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
  auth: taodockAuth,
  authors: ['taodock-api'],
  actions: [
    listModels,
    generateImage,
    createVideo,
    getVideoStatus,
    downloadVideo,
    createCustomApiCallAction({
      auth: taodockAuth,
      baseUrl: () => TAODOCK_API_BASE_URL,
      authMapping: async (auth) => ({
        Authorization: `Bearer ${auth.secret_text}`,
        'X-Taodock-Plugin': TAODOCK_PLUGIN_HEADER,
      }),
    }),
  ],
  triggers: [],
});
