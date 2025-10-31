import type { Provider } from '@common/types';
import { stringifyOpenAISetting } from '@common/utils';
import supabase from './client';
import { logger } from '../utils/logger';

interface ProviderRow {
  id: number;
  user_id: string | null;
  name: string;
  title: string | null;
  models: string | null;
  openai_setting: string | null;
  created_at: string;
  updated_at: string;
}

const defaultProviders: Array<Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    name: 'bigmodel',
    title: '智谱AI',
    models: ['glm-4.5-flash'],
    openAISetting: stringifyOpenAISetting({
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: '',
    }),
  },
  {
    name: 'deepseek',
    title: '深度求索 (DeepSeek)',
    models: ['deepseek-chat'],
    openAISetting: stringifyOpenAISetting({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: '',
    }),
  },
  {
    name: 'siliconflow',
    title: '硅基流动',
    models: ['Qwen/Qwen3-8B', 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B'],
    openAISetting: stringifyOpenAISetting({
      baseURL: 'https://api.siliconflow.cn/v1',
      apiKey: '',
    }),
  },
  {
    name: 'qianfan',
    title: '百度千帆',
    models: ['ernie-speed-128k', 'ernie-4.0-8k', 'ernie-3.5-8k'],
    openAISetting: stringifyOpenAISetting({
      baseURL: 'https://qianfan.baidubce.com/v2',
      apiKey: '',
    }),
  },
];

const mapRowToProvider = (row: ProviderRow): Provider => ({
  id: row.id,
  name: row.name,
  title: row.title ?? undefined,
  models: row.models ? JSON.parse(row.models) : [],
  openAISetting: row.openai_setting ?? undefined,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
});

const mapProviderToRow = (userId: string, provider: Partial<Provider>) => ({
  ...(provider.id ? { id: provider.id } : {}),
  user_id: userId,
  name: provider.name ?? '',
  title: provider.title ?? null,
  models: JSON.stringify(provider.models ?? []),
  openai_setting: provider.openAISetting ?? null,
});

export async function fetchProviders(userId: string): Promise<Provider[]> {
  try {
    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) {
      throw error;
    }
    return (data ?? []).map(mapRowToProvider);
  } catch (err) {
    logger.error('Error fetching providers:', err);
    throw err;
  }
}

export async function upsertProvider(
  userId: string,
  provider: Partial<Provider>
): Promise<Provider> {
  try {
    const payload = mapProviderToRow(userId, provider);
    const { data, error } = await supabase
      .from('providers')
      .upsert(payload)
      .select()
      .limit(1);
    if (error) {
      throw error;
    }
    const row = data?.[0] as ProviderRow | undefined;
    if (!row) {
      throw new Error('Supabase did not return provider data.');
    }
    return mapRowToProvider(row);
  } catch (err) {
    logger.error('Error upserting provider:', err);
    throw err;
  }
}

export async function deleteProvider(
  id: number,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('providers')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) {
      throw error;
    }
  } catch (err) {
    logger.error('Error deleting provider:', err);
    throw err;
  }
}

export async function ensureDefaultProviders(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('providers')
      .select('name')
      .eq('user_id', userId);
    if (error) {
      throw error;
    }

    const existingNames = new Set((data ?? []).map((item) => item.name));
    const rows = defaultProviders
      .filter((provider) => !existingNames.has(provider.name))
      .map((provider) => mapProviderToRow(userId, provider));

    if (!rows.length) return;

    const { error: insertError } = await supabase.from('providers').insert(rows);
    if (insertError) {
      throw insertError;
    }
  } catch (err) {
    logger.error('Error ensuring default providers:', err);
    throw err;
  }
}
