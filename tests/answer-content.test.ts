import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import AnswerContent from '../renderer/components/AnswerContent.vue';

it('renders a reasoning-only turn as finished with its warning, never as perpetual loading', () => {
  const wrapper = mount(AnswerContent, {
    props: { message: { id: 'test', conversationId: 'test', type: 'answer', createdAt: 1, dirty: false,
      content: '', reasoningContent: 'reasoning output', status: 'success', finishReason: 'length' } },
    global: { stubs: { MessageRender: true } },
  });
  expect(wrapper.find('details').exists()).toBe(true);
  expect(wrapper.text()).toContain('达到模型输出上限');
  expect(wrapper.find('[role="status"]').exists()).toBe(false);
  expect(wrapper.find('details').attributes('open')).toBeUndefined();
});
