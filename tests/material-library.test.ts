import { mount, flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import MaterialLibrary from "../renderer/views/materials.vue";
import type { MaterialApi, ImportJob } from "../common/materials";
it("lets the user preview inert text, import files, confirm cancellation and release the observer on leaving", async () => {
  const unsubscribe = vi.fn();
  const job: ImportJob = {
    requestId: "import",
    digest: "digest",
    createdAt: 1,
    status: "running",
    items: [{ name: "notes.md", size: 12, status: "pending" }],
  };
  const api = {
    isEnabled: vi.fn(async () => true),
    search: vi.fn(async () => ({
      items: [{ id: "doc", name: "notes.md", bytes: 12, createdAt: 1 }],
      cursor: null,
      usage: { documents: 1, bytes: 12 },
    })),
    listImports: vi.fn(async () => ({ items: [], cursor: null })),
    readText: vi.fn(async () => ({
      text: "<script>alert(1)</script>",
      offset: 0,
      nextOffset: null,
    })),
    chooseFiles: vi.fn(async () => ({
      selectionId: "pick",
      files: [{ name: "notes.md", size: 12 }],
    })),
    startImport: vi.fn(async () => job),
    cancelImport: vi.fn(async () => ({ ...job, status: "cancelled" })),
    observeImports: vi.fn(() => unsubscribe),
    cancelSearch: vi.fn(async () => {}),
    getImport: vi.fn(async () => job),
  } as unknown as MaterialApi;
  window.api.materials = api;
  const wrapper = mount(MaterialLibrary);
  await flushPromises();
  const click = async (label: string) => {
    const button = wrapper.findAll("button").find((b) => b.text() === label);
    expect(button, `button ${label}`).toBeTruthy();
    await button!.trigger("click");
    await flushPromises();
  };
  await click("notes.md");
  expect(wrapper.get('[aria-label="资料正文"]').text()).toBe(
    "<script>alert(1)</script>",
  );
  expect(wrapper.find("script").exists()).toBe(false);
  await click("导入资料");
  expect(api.startImport).toHaveBeenCalledOnce();
  await click("停止导入");
  expect(wrapper.text()).toContain("已取消");
  wrapper.unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
});
it("explains overlong queries before sending them to the host", async () => {
  const search = vi.fn(async () => ({
    items: [],
    cursor: null,
    usage: { documents: 0, bytes: 0 },
  }));
  window.api.materials = {
    search,
    listImports: async () => ({ items: [], cursor: null }),
    cancelSearch: async () => {},
    observeImports: () => () => {},
  } as unknown as MaterialApi;
  const wrapper = mount(MaterialLibrary);
  await flushPromises();
  await wrapper.get('input[aria-label="搜索资料"]').setValue("a".repeat(129));
  await new Promise((resolve) => setTimeout(resolve, 250));
  await flushPromises();
  expect(search).toHaveBeenCalledTimes(1);
  expect(wrapper.text()).toContain("128");
  wrapper.unmount();
});
it("unlocks import when the active account changes while the picker is pending", async () => {
  let listener: (
    event: import("../common/materials").MaterialEvent,
  ) => void = () => {};
  let finishPicker: (value: null) => void = () => {};
  const picker = new Promise<null>((resolve) => (finishPicker = resolve));
  window.api.materials = {
    search: async () => ({
      items: [],
      cursor: null,
      usage: { documents: 0, bytes: 0 },
    }),
    listImports: async () => ({ items: [], cursor: null }),
    chooseFiles: () => picker,
    cancelSearch: async () => {},
    observeImports: (
      cb: (event: import("../common/materials").MaterialEvent) => void,
    ) => {
      listener = cb;
      return () => {};
    },
  } as unknown as MaterialApi;
  const wrapper = mount(MaterialLibrary);
  await flushPromises();
  const importButton = () =>
    wrapper.findAll("button").find((b) => b.text() === "导入资料")!;
  await wrapper.get('input[aria-label="搜索资料"]').setValue("旧账号查询");
  await importButton().trigger("click");
  await flushPromises();
  expect(importButton().attributes("disabled")).toBeDefined();
  listener({ type: "scope", lease: null });
  listener({ type: "scope", lease: "new-account" });
  await flushPromises();
  expect(
    (wrapper.get('input[aria-label="搜索资料"]').element as HTMLInputElement)
      .value,
  ).toBe("");
  expect(importButton().attributes("disabled")).toBeUndefined();
  finishPicker(null);
  await flushPromises();
  wrapper.unmount();
});
