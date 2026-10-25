import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEncoder } from '@ag-ui/encoder';
import { EventType } from '@ag-ui/core';
import { RunAgentInputSchema } from '@ag-ui/core/schemas';
import type { AgentPort, RewriteRequest, RunSnapshot } from '../../common/content/contracts';
import { terminal, validRequest } from './protocol';
export interface AuthorizationContext { action: 'start' | 'get' | 'cancel'; requestId: string; request?: RewriteRequest }
export type AuthorizeContentRequest = (request: IncomingMessage, context: AuthorizationContext) => boolean | Promise<boolean>;
export function createContentGatewayHandler(gateway: AgentPort, authorize: AuthorizeContentRequest) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const json = (status: number, body: unknown) => res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(body));
    try {
      const cancel = /^\/runs\/([a-zA-Z0-9_-]{1,128})\/cancel$/.exec(req.url ?? '');
      if (req.method === 'POST' && cancel) {
        if (!await authorize(req, { action: 'cancel', requestId: cancel[1] })) { json(403, { code: 'FORBIDDEN' }); return; }
        json(200, await gateway.cancel(cancel[1])); return;
      }
      const read = /^\/runs\/([a-zA-Z0-9_-]{1,128})$/.exec(req.url ?? '');
      if (req.method === 'GET' && read) {
        if (!await authorize(req, { action: 'get', requestId: read[1] })) { json(403, { code: 'FORBIDDEN' }); return; }
        json(200, await gateway.get(read[1])); return;
      }
      if (req.method !== 'POST' || req.url !== '/runs') { json(404, { code: 'NOT_FOUND' }); return; }
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 65536) { json(413, { code: 'REQUEST_TOO_LARGE' }); return; } chunks.push(Buffer.from(chunk)); }
      const input = RunAgentInputSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      const request: unknown = input.forwardedProps?.request;
      if (!validRequest(request) || input.runId !== request.requestId || input.threadId !== request.scopeId
        || input.messages.length || input.tools.length || input.context.length || Object.keys(input.state ?? {}).length
        || Object.keys(input.forwardedProps).some(k => k !== 'request')) { json(400, { code: 'INVALID_REQUEST' }); return; }
      if (!await authorize(req, { action: 'start', requestId: request.requestId, request })) { json(403, { code: 'FORBIDDEN' }); return; }
      const encoder = new EventEncoder(); let streaming = false; let latest: RunSnapshot | undefined;
      const send = (snapshot: RunSnapshot) => {
        latest = snapshot;
        if (!streaming || res.destroyed || res.writableEnded) return;
        res.write(encoder.encode({ type: EventType.STATE_SNAPSHOT, snapshot }));
        if (snapshot.status === 'failed') res.write(encoder.encode({ type: EventType.RUN_ERROR, code: snapshot.error?.code, message: snapshot.error?.message ?? '生成失败' }));
        else if (terminal(snapshot.status)) res.write(encoder.encode({ type: EventType.RUN_FINISHED, threadId: request.scopeId, runId: request.requestId }));
        if (terminal(snapshot.status) || snapshot.status === 'unknown') res.end();
      };
      const unsubscribe = gateway.observe(request.requestId, send); res.once('close', unsubscribe);
      try {
        const initial = await gateway.start(request);
        if (res.destroyed) { unsubscribe(); return; }
        res.writeHead(200, { 'content-type': encoder.getContentType(), 'cache-control': 'no-cache, no-store', 'x-accel-buffering': 'no' });
        res.write(encoder.encode({ type: EventType.RUN_STARTED, threadId: request.scopeId, runId: request.requestId }));
        streaming = true; send(latest ?? initial);
      } catch (error) { unsubscribe(); throw error; }
    } catch (error) {
      const code = error instanceof Error && ['WORKSPACE_BUSY', 'REQUEST_CONFLICT'].includes(error.message) ? error.message : 'INVALID_REQUEST';
      if (!res.headersSent) json(code === 'INVALID_REQUEST' ? 400 : 409, { code }); else res.end();
    }
  };
}
