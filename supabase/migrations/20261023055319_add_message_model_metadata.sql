alter table public.messages add column if not exists metadata jsonb not null default '{}'::jsonb;
comment on column public.messages.metadata is 'Model response metadata: reasoningContent, finishReason, error. Protected by the existing message owner RLS policies.';
