import type { InjectionKey, ComputedRef, Ref } from "vue";

export const CTX_KEY: InjectionKey<{
  width: ComputedRef<number>;
  editId: ComputedRef<string | void>;
  checkedIds: Ref<string[]>;
}> = Symbol("ConversationListCtx");
