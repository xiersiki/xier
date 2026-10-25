import type { RewriteResult, RunStatus } from '../../common/content/contracts';
/** Pure transport validation, safe to import in the renderer; no SDK or Node dependency. */
export function validResult(value: unknown): value is RewriteResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.replacement === 'string' && v.replacement.trim().length > 0 && [...v.replacement].length <= 20000
    && (v.explanation === undefined || typeof v.explanation === 'string')
    && Object.keys(v).every(k => k === 'replacement' || k === 'explanation');
}
export function terminal(status: RunStatus) { return status === 'completed' || status === 'failed' || status === 'cancelled'; }
export function validId(value: unknown): value is string { return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value); }
export function validRequest(value: unknown): value is import('../../common/content/contracts').RewriteRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return validId(v.requestId) && validId(v.scopeId) && validId(v.draftId)
    && typeof v.selectedText === 'string' && v.selectedText.trim().length > 0 && [...v.selectedText].length <= 4000
    && typeof v.requirement === 'string' && [...v.requirement].length <= 4000
    && Object.keys(v).every(k => ['requestId', 'scopeId', 'draftId', 'selectedText', 'requirement'].includes(k));
}
const errorMessages: Record<string, string> = {
  INVALID_RESULT: '服务未返回有效改写结果', INCOMPATIBLE_SERVICE: '需要 OpenCode 1.19.4',
  SERVICE_REJECTED: '服务拒绝请求，请检查连接配置', MODEL_FAILED: '模型未完成改写，请检查服务配置',
  CONNECTION_LOST: '连接中断，请核实任务状态', GENERATION_FAILED: '生成失败',
  WORKSPACE_BUSY: '已有任务正在运行或等待核实', REQUEST_CONFLICT: '请求标识与原输入不一致',
};
export function safeError(code: unknown) {
  const key = typeof code === 'string' && Object.prototype.hasOwnProperty.call(errorMessages, code) ? code : 'GENERATION_FAILED';
  return { code: key, message: errorMessages[key] };
}
export function parseSnapshot(value: unknown, requestId: string): import('../../common/content/contracts').RunSnapshot | undefined {
  if (!value || typeof value !== 'object') return;
  const v = value as Record<string, unknown>;
  if (v.requestId !== requestId || !Number.isSafeInteger(v.sequence) || (v.sequence as number) < 0
    || !['running', 'completed', 'failed', 'cancelled', 'unknown'].includes(v.status as string)) return;
  if (v.status === 'completed' && !validResult(v.result)) return;
  return { requestId, sequence: v.sequence as number, status: v.status as RunStatus,
    ...(v.status === 'completed' ? { result: { ...(v.result as RewriteResult) } } : {}),
    ...(v.error || v.status === 'failed' ? { error: safeError((v.error as { code?: unknown } | undefined)?.code) } : {}),
  };
}
export function freezeSnapshot(snapshot: import('../../common/content/contracts').RunSnapshot) {
  return Object.freeze({ ...snapshot,
    ...(snapshot.result ? { result: Object.freeze({ ...snapshot.result }) } : {}),
    ...(snapshot.error ? { error: Object.freeze({ ...snapshot.error }) } : {}),
  });
}
