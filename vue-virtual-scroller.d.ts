declare module "vue-virtual-scroller" {
  import { DefineComponent, VNode } from "vue";

  export interface DynamicScrollerProps {
    items: any[];
    minItemSize: number | string;
    keyField?: string;
    [key: string]: any;
  }

  export interface DynamicScrollerItemProps {
    item: any;
    active: boolean;
    sizeDependencies?: any[];
    [key: string]: any;
  }

  export const DynamicScroller: DefineComponent<
    DynamicScrollerProps,
    {
      scrollToBottom: () => void;
      scrollToItem: (index: number) => void;
    },
    any
  >;

  export const DynamicScrollerItem: DefineComponent<
    DynamicScrollerItemProps,
    any,
    any
  >;
  export const RecycleScroller: DefineComponent<any, any, any>;
}
