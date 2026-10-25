import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import ContextSelection from '../renderer/features/content/components/ContextSelection.vue';
it('submits a preset or a custom requirement through its public event', async () => {
  const wrapper = mount(ContextSelection, { props: { selectedText: '待改写', count: 3, limit: 4000 } });
  expect(wrapper.text()).toContain('待改写');
  await wrapper.get('form').trigger('submit');
  expect(wrapper.emitted('submit')?.[0]).toEqual(['让表达更清晰，保留原意']);
  await wrapper.get('textarea').setValue('保留第一人称');
  await wrapper.get('form').trigger('submit');
  expect(wrapper.emitted('submit')?.[1]).toEqual(['保留第一人称']);
  await wrapper.setProps({ disabledReason: '请先选择文本' });
  await wrapper.get('form').trigger('submit');
  expect(wrapper.emitted('submit')).toHaveLength(2);
});

import RewriteSuggestion from '../renderer/features/content/components/RewriteSuggestion.vue';
it('renders escaped diff with textual labels and disables stale acceptance while preserving copy', async () => {
  const wrapper = mount(RewriteSuggestion, { props: { before: '原文', after: '<img src=x onerror=alert(1)>', status: 'reviewable', canAccept: true } });
  expect(wrapper.text()).toContain('原文'); expect(wrapper.text()).toContain('<img'); expect(wrapper.find('img').exists()).toBe(false);
  expect(wrapper.text()).toContain('删去'); expect(wrapper.text()).toContain('新增');
  await wrapper.get('[data-action="accept"]').trigger('click'); expect(wrapper.emitted('accept')).toHaveLength(1);
  await wrapper.setProps({ status: 'stale', canAccept: false });
  expect(wrapper.get('[data-action="accept"]').attributes('disabled')).toBeDefined();
  await wrapper.get('[data-action="copy"]').trigger('click'); expect(wrapper.emitted('copy')).toHaveLength(1);
  await wrapper.get('[data-action="reject"]').trigger('click'); expect(wrapper.emitted('reject')).toHaveLength(1);
});

import GenerationStatus from '../renderer/features/content/components/GenerationStatus.vue';
it('announces uncertain status and emits refresh or cancel instead of claiming success', async () => {
  const wrapper = mount(GenerationStatus, { props: { status: 'unknown', canCancel: true } });
  expect(wrapper.get('[role="status"]').text()).toContain('待核实');
  await wrapper.get('[data-action="refresh"]').trigger('click'); expect(wrapper.emitted('refresh')).toHaveLength(1);
  await wrapper.get('[data-action="cancel"]').trigger('click'); expect(wrapper.emitted('cancel')).toHaveLength(1);
  await wrapper.setProps({ status: 'cancelling', canCancel: false });
  expect(wrapper.text()).toContain('等待取消确认'); expect(wrapper.find('[data-action="cancel"]').exists()).toBe(false);
  await wrapper.setProps({ status: 'failed', errorMessage: '结果无效' });
  await wrapper.get('[data-action="retry"]').trigger('click'); expect(wrapper.emitted('retry')).toHaveLength(1);
});
