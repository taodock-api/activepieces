import { HttpMethod, httpClient } from '@activepieces/pieces-common';
import { TAODOCK_API_BASE_URL, TAODOCK_PLUGIN_HEADER } from './constants';

export function taodockHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'X-Taodock-Plugin': TAODOCK_PLUGIN_HEADER,
  };
}

export async function getTaodockResource<T>({
  apiKey,
  path,
}: GetTaodockResourceParams): Promise<T> {
  const response = await httpClient.sendRequest<T>({
    method: HttpMethod.GET,
    url: `${TAODOCK_API_BASE_URL}/${path.replace(/^\/+/, '')}`,
    headers: taodockHeaders(apiKey),
  });
  return response.body;
}

type GetTaodockResourceParams = {
  apiKey: string;
  path: string;
};
