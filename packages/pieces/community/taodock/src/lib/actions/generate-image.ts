import { HttpMethod, httpClient } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { randomBytes } from 'node:crypto';
import { taodockAuth } from '../auth';
import { TAODOCK_API_BASE_URL } from '../common/constants';
import { taodockHeaders } from '../common/http';
import { findModel } from '../common/models';
import { imageModelProp } from '../common/props';

export const generateImage = createAction({
  auth: taodockAuth,
  name: 'generate_image',
  classification: 'READ',
  displayName: 'Generate Image',
  description: 'Generates and saves images using an authorized Taodock image model.',
  audience: 'both',
  aiMetadata: {
    description:
      'Generates images from a text instruction with an image-capable model authorized for the connected Taodock key, then returns Activepieces file URLs. Use List Models if the model is unknown. Each call consumes quota and creates new output, so retries are not idempotent.',
    idempotent: false,
  },
  props: {
    model: imageModelProp,
    prompt: Property.LongText({
      displayName: 'Prompt',
      description: 'The instruction describing the image to generate.',
      required: true,
    }),
    parameters: Property.Json({
      displayName: 'Model Parameters',
      description:
        'Optional model-specific fields from the Taodock model guide, such as size or quality. Model and prompt values here are ignored.',
      required: false,
    }),
  },
  async run(context) {
    const model = await findModel({
      apiKey: context.auth.secret_text,
      id: context.propsValue.model,
      kind: 'image',
    });
    const parameters = withoutProtectedFields({
      value: context.propsValue.parameters ?? {},
      protectedFields: ['model', 'prompt', 'contents'],
    });
    const headers = taodockHeaders(context.auth.secret_text);
    const images = model.imageRoute === 'gemini-generate-content'
      ? parseGeminiImages(
          (
            await httpClient.sendRequest<GeminiResponse>({
              method: HttpMethod.POST,
              url: `${TAODOCK_API_BASE_URL}/models/${encodeURIComponent(model.id)}:generateContent`,
              headers,
              body: {
                ...parameters,
                contents: [{ role: 'user', parts: [{ text: context.propsValue.prompt }] }],
              },
            })
          ).body,
        )
      : parseOpenAiImages(
          (
            await httpClient.sendRequest<ImagesResponse>({
              method: HttpMethod.POST,
              url: `${TAODOCK_API_BASE_URL}/images/generations`,
              headers,
              body: {
                ...parameters,
                model: model.id,
                prompt: context.propsValue.prompt,
              },
            })
          ).body,
        );

    if (images.length === 0) {
      throw new Error(`${model.id} returned no image.`);
    }

    const saved: SavedImage[] = [];
    for (const [index, image] of images.entries()) {
      let data: Buffer;
      let extension = extensionForMime(image.mimeType);
      if (image.base64) {
        data = Buffer.from(image.base64, 'base64');
      } else if (image.url) {
        const url = new URL(image.url);
        if (url.protocol !== 'https:') {
          throw new Error('Generated image URLs must use HTTPS.');
        }
        const download = await httpClient.sendRequest<ArrayBuffer>({
          method: HttpMethod.GET,
          url: url.toString(),
          responseType: 'arraybuffer',
          timeout: 120_000,
        });
        data = Buffer.from(download.body);
        extension = extensionForMime(firstHeader(download.headers?.['content-type']));
      } else {
        throw new Error(`Generated image ${index + 1} has no file data.`);
      }
      if (data.byteLength > MAX_IMAGE_BYTES) {
        throw new Error(`Generated image ${index + 1} exceeds the 25 MiB limit.`);
      }
      const fileName = `${safeFilePart(model.id)}-${randomBytes(6).toString('hex')}-${index + 1}.${extension}`;
      const fileUrl = await context.files.write({ fileName, data });
      saved.push({
        fileName,
        fileUrl,
        ...(image.revisedPrompt ? { revisedPrompt: image.revisedPrompt } : {}),
      });
    }

    return { count: saved.length, images: saved };
  },
});

function parseOpenAiImages(body: ImagesResponse): ImagePayload[] {
  return (body.data ?? []).flatMap((image) =>
    image.b64_json || image.url
      ? [
          {
            ...(image.b64_json ? { base64: image.b64_json } : {}),
            ...(image.url ? { url: image.url } : {}),
            ...(image.revised_prompt ? { revisedPrompt: image.revised_prompt } : {}),
          },
        ]
      : [],
  );
}

function parseGeminiImages(body: GeminiResponse): ImagePayload[] {
  const images: ImagePayload[] = [];
  for (const candidate of body.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const base64 = part.inlineData?.data ?? part.inline_data?.data;
      if (!base64) {
        continue;
      }
      const mimeType = part.inlineData?.mimeType ?? part.inline_data?.mime_type;
      images.push({ base64, ...(mimeType ? { mimeType } : {}) });
    }
  }
  return images;
}

function withoutProtectedFields({ value, protectedFields }: WithoutProtectedFieldsParams): Record<string, unknown> {
  const blocked = new Set(protectedFields);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !blocked.has(key)));
}

function extensionForMime(mimeType: string | undefined): string {
  const normalized = mimeType?.split(';', 1)[0]?.trim().toLowerCase();
  if (normalized === 'image/jpeg') {
    return 'jpg';
  }
  if (normalized === 'image/webp') {
    return 'webp';
  }
  if (normalized === 'image/gif') {
    return 'gif';
  }
  return 'png';
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'taodock-image';
}

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

type WithoutProtectedFieldsParams = {
  value: Record<string, unknown>;
  protectedFields: string[];
};

type ImagePayload = {
  base64?: string;
  url?: string;
  mimeType?: string;
  revisedPrompt?: string;
};

type SavedImage = {
  fileName: string;
  fileUrl: string;
  revisedPrompt?: string;
};

type ImagesResponse = {
  data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { data?: string; mimeType?: string };
        inline_data?: { data?: string; mime_type?: string };
      }>;
    };
  }>;
};
