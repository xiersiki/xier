import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import ContentWorkspace from '../renderer/features/content/ContentWorkspace.vue';
import { FixtureAgentPort } from '../renderer/platform/content/fixture-agent';
import { browserFiles } from '../renderer/platform/content/browser-files';
afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); });
it('runs the user-facing sample, review, accept and undo loop and copies without applying', async () => {
  vi.useFakeTimers(); const copy = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
  const wrapper = mount(ContentWorkspace, { attachTo: document.body, props: { files: browserFiles, port: new FixtureAgentPort(), scopeId: 'test' } });
  expect(wrapper.text()).toContain('固定示例');
  await wrapper.get('[data-action="sample"]').trigger('click');
  const original = wrapper.get('[role="textbox"]').text();
  await wrapper.get('[data-action="select-all"]').trigger('click');
  await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(wrapper.get('[role="textbox"]').text()).toBe(original);
  await vi.advanceTimersByTimeAsync(700); await flushPromises();
  await wrapper.get('[data-action="copy"]').trigger('click'); await flushPromises();
  expect(copy).toHaveBeenCalledWith('让表达更清晰，让协作更顺畅。');
  expect(wrapper.get('[role="textbox"]').text()).toBe(original);
  await wrapper.get('[data-action="accept"]').trigger('click');
  expect(wrapper.get('[role="textbox"]').text()).toBe('让表达更清晰，让协作更顺畅。');
  await wrapper.get('[data-action="undo"]').trigger('click');
  expect(wrapper.get('[role="textbox"]').text()).toBe(original);
  expect(wrapper.get('[data-action="accept"]').attributes('disabled')).toBeDefined();
  wrapper.unmount();
});

it('imports a copy, reports clipboard failure and exports current text through FilePort', async () => {
  const exported: string[] = [];
  const source = new TextEncoder().encode('中文😀\r\n第二行');
  const wrapper = mount(ContentWorkspace, { props: { port: new FixtureAgentPort(), scopeId: 'test', files: {
    read: async () => ({ name: 'input.md', bytes: source }),
    export: async (_, text) => { exported.push(text); }, copy: async () => { throw new Error('denied'); },
  } } });
  const input = wrapper.get('input[type="file"]');
  Object.defineProperty(input.element, 'files', { value: [new File(['unused'], 'input.md')] });
  await input.trigger('change'); await flushPromises();
  expect(wrapper.text()).toContain('已导入副本');
  const buttons = wrapper.findAll('button');
  await buttons.find(button => button.text() === '导出正文')!.trigger('click'); await flushPromises();
  expect(exported).toEqual(['中文😀\n第二行']);
  expect(new TextDecoder().decode(source)).toBe('中文😀\r\n第二行');
  await wrapper.get('[data-action="select-all"]').trigger('click');
  vi.useFakeTimers(); await wrapper.get('form').trigger('submit'); await vi.advanceTimersByTimeAsync(700); await flushPromises();
  await wrapper.get('[data-action="copy"]').trigger('click'); await flushPromises();
  expect(wrapper.text()).toContain('复制失败'); expect(wrapper.get('[role="textbox"]').text()).toContain('中文😀');
  wrapper.unmount();
});
