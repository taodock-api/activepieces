import { HttpMethod, httpClient } from '@activepieces/pieces-common';
import { TAODOCK_CATALOG_URL } from './constants';
import { getTaodockResource } from './http';

export type ModelKind = 'text' | 'image' | 'video' | 'embedding' | 'rerank';
export type ImageRoute = 'images' | 'gemini-generate-content';

export type TaodockModel = {
  id: string;
  kind: ModelKind;
  endpoints: string[];
  ownedBy?: string;
  imageRoute?: ImageRoute;
};

export async function getModels(apiKey: string): Promise<TaodockModel[]> {
  const availableResponse = await getTaodockResource<ModelsResponse>({
    apiKey,
    path: 'models?scope=authorized',
  });
  const catalogResponse = await httpClient
    .sendRequest<CatalogResponse>({
      method: HttpMethod.GET,
      url: TAODOCK_CATALOG_URL,
    })
    .catch(() => undefined);
  const catalog = catalogResponse?.body.success === false ? [] : catalogResponse?.body.data ?? [];
  return classifyModels({ available: availableResponse.data ?? [], catalog }).sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

export async function findModel({ apiKey, id, kind }: FindModelParams): Promise<TaodockModel> {
  const model = (await getModels(apiKey)).find((candidate) => candidate.id === id);
  if (!model) {
    throw new Error(`${id} is not available to this Taodock API key.`);
  }
  if (model.kind !== kind) {
    throw new Error(`${id} is a ${model.kind} model, not a ${kind} model.`);
  }
  return model;
}

function classifyModels({ available, catalog }: ClassifyModelsParams): TaodockModel[] {
  const catalogById = new Map(catalog.map((model) => [model.model_name, model]));
  const models: TaodockModel[] = [];

  for (const availableModel of available) {
    if (!availableModel.id) {
      continue;
    }
    const catalogModel = catalogById.get(availableModel.id);
    const endpoints = [
      ...new Set([
        ...(availableModel.supported_endpoint_types ?? []),
        ...(catalogModel?.supported_endpoint_types ?? []),
      ]),
    ];
    const endpointSet = new Set(endpoints);
    const common = {
      id: availableModel.id,
      endpoints,
      ...(availableModel.owned_by ? { ownedBy: availableModel.owned_by } : {}),
    };

    if (availableModel.kind === 'image') {
      const imageRoute = routeForImage({ endpoints: endpointSet, preferred: availableModel.image_route });
      if (imageRoute) {
        models.push({ ...common, kind: 'image', imageRoute });
      }
      continue;
    }
    if (availableModel.kind) {
      models.push({ ...common, kind: availableModel.kind });
      continue;
    }
    if (endpointSet.has('openai-video') || catalogSaysVideo(catalogModel)) {
      models.push({ ...common, kind: 'video' });
      continue;
    }
    if (endpointSet.has('image-generation') || catalogSaysImage(catalogModel)) {
      const imageRoute = routeForImage({ endpoints: endpointSet });
      if (imageRoute) {
        models.push({ ...common, kind: 'image', imageRoute });
      }
      continue;
    }
    if (endpointSet.has('embeddings')) {
      models.push({ ...common, kind: 'embedding' });
      continue;
    }
    if (endpointSet.has('jina-rerank')) {
      models.push({ ...common, kind: 'rerank' });
      continue;
    }
    if ((availableModel.supported_endpoint_types ?? []).some((endpoint) => TEXT_ENDPOINTS.has(endpoint))) {
      models.push({ ...common, kind: 'text' });
    }
  }

  return models;
}

function routeForImage({ endpoints, preferred }: RouteForImageParams): ImageRoute | undefined {
  if (preferred === 'images' || preferred === 'gemini-generate-content') {
    return preferred;
  }
  if (endpoints.has('gemini')) {
    return 'gemini-generate-content';
  }
  if (endpoints.has('image-generation')) {
    return 'images';
  }
  return undefined;
}

function catalogSaysImage(model: CatalogModel | undefined): boolean {
  return Boolean(
    model?.media_options?.image != null ||
      (model?.image_generation_prices ?? []).some(
        (item) => Boolean(item.size) && typeof item.price === 'number' && item.price > 0,
      ) ||
      priced(model?.image_feature_prices),
  );
}

function catalogSaysVideo(model: CatalogModel | undefined): boolean {
  return Boolean(
    model?.media_options?.video != null ||
      Object.values(model?.video_resolution_price ?? {}).some((price) => price > 0) ||
      priced(model?.video_feature_prices),
  );
}

function priced(items: ReadonlyArray<{ price?: number }> | null | undefined): boolean {
  return (items ?? []).some((item) => typeof item.price === 'number' && item.price > 0);
}

const TEXT_ENDPOINTS = new Set(['openai', 'openai-response', 'openai-response-compact', 'anthropic']);

type FindModelParams = {
  apiKey: string;
  id: string;
  kind: ModelKind;
};

type ClassifyModelsParams = {
  available: AvailableModel[];
  catalog: CatalogModel[];
};

type RouteForImageParams = {
  endpoints: ReadonlySet<string>;
  preferred?: ImageRoute | null;
};

type ModelsResponse = {
  data?: AvailableModel[];
};

type CatalogResponse = {
  success?: boolean;
  data?: CatalogModel[];
};

type AvailableModel = {
  id: string;
  owned_by?: string;
  kind?: ModelKind | null;
  image_route?: ImageRoute | null;
  supported_endpoint_types?: string[] | null;
};

type CatalogModel = {
  model_name: string;
  supported_endpoint_types?: string[] | null;
  media_options?: { image?: unknown; video?: unknown } | null;
  image_generation_prices?: Array<{ size?: string; price?: number }> | null;
  image_feature_prices?: Array<{ price?: number }> | null;
  video_resolution_price?: Record<string, number> | null;
  video_feature_prices?: Array<{ price?: number }> | null;
};
