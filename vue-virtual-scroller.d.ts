declare module 'vue-virtual-scroller' {
  import type { ComponentPublicInstance, VNode } from 'vue';
  export interface DynamicScrollerProps {
    items: any[]; minItemSize: number | string; keyField?: string; [key: string]: any;
  }
  export const DynamicScroller: new () => ComponentPublicInstance<DynamicScrollerProps> & {
    scrollToBottom(): void;
    scrollToItem(index: number): void;
    $slots: { default(props: { item: any; index: number; active: boolean }): VNode[] };
  };
  export const DynamicScrollerItem: new () => ComponentPublicInstance<{
    item: any; active: boolean; sizeDependencies?: any[]; [key: string]: any;
  }> & { $slots: { default(): VNode[] } };
  export const RecycleScroller: new () => ComponentPublicInstance<any>;
}
