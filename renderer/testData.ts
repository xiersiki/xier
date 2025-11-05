import { Message, Conversation } from "@common/types";

/**
 * 生成随机日期时间戳
 * @param start 开始日期
 * @param end 结束日期
 * @returns 时间戳数字
 */
const randomDate = (start: Date, end: Date): number => {
  return start.getTime() + Math.random() * (end.getTime() - start.getTime());
};

// 定义测试数据的日期范围
const startDate = new Date(2024, 0, 1); // 2024年1月1日
const endDate = new Date(2024, 11, 31); // 2024年12月31日

// ✅ 测试内容库（用于生成大量测试数据）
const testQuestions = [
  "什么是光合作用？能简单介绍一下吗？",
  "光合作用的具体过程是怎样的？有哪些关键步骤？",
  "哪些因素会影响光合作用的效率？",
  "人工智能目前的发展趋势是什么？",
  "AI技术在医疗领域有哪些具体应用？",
  "量子计算和传统计算有什么本质区别？",
  "区块链技术的核心原理是什么？",
  "云计算相比传统IT架构有哪些优势？",
  "TypeScript 和 JavaScript 有什么区别？",
  "Vue 3 和 Vue 2 的主要区别是什么？",
];

const testAnswers = [
  "光合作用是绿色植物、藻类和某些细菌利用叶绿素吸收光能，将二氧化碳和水转化为有机物并释放氧气的过程。这是地球上几乎所有生命能量的来源。",
  "光合作用分为光反应和暗反应两个阶段。光反应发生在类囊体膜上，通过光解水产生氧气、ATP和NADPH；暗反应（卡尔文循环）发生在叶绿体基质中，利用这些能量将二氧化碳固定成有机物。",
  "当前AI发展呈现出大模型、多模态融合、低代码化、专用化等趋势。大语言模型如GPT、Claude等能力持续提升，同时AI在医疗、金融、教育等垂直领域的应用也日益深入。",
  "AI在医疗领域的应用非常广泛，包括医学影像诊断、药物研发、智能病历管理、个性化治疗方案制定等。例如，深度学习算法已能在某些癌症筛查中达到甚至超过专业医生的水平。",
  "量子计算利用量子叠加和纠缠等量子力学原理，可以同时处理多个状态，在某些特定问题上具有指数级的性能优势。而传统计算基于二进制位，一次只能处理一个确定的状态。",
  "区块链是一种分布式账本技术，通过密码学、共识机制和点对点网络实现数据的去中心化存储和防篡改。每个区块包含前一个区块的哈希值，形成链式结构。",
  "云计算提供了弹性伸缩、按需付费、高可用性等优势。企业无需投资昂贵的硬件设施，可以根据业务需求灵活调整资源，大幅降低IT成本和运维复杂度。",
  "TypeScript 是 JavaScript 的超集，添加了静态类型系统和更强的面向对象特性。它在编译时就能发现类型错误，提高了代码的可维护性和开发效率，尤其适合大型项目。",
  "Vue 3 采用了 Composition API、Teleport、Fragments 等新特性，性能相比 Vue 2 提升了约 2 倍，同时支持 TypeScript 更友好，tree-shaking 更彻底，打包体积更小。",
  "这是一个较长的回答示例。\n\n## 标题示例\n\n在软件开发中，我们经常需要处理各种复杂的场景：\n\n1. **性能优化**：通过虚拟列表、懒加载等技术提升渲染性能\n2. **代码质量**：使用 ESLint、Prettier 保证代码规范\n3. **自动化测试**：编写单元测试和集成测试确保功能稳定\n\n```typescript\n// 代码示例\nconst fibonacci = (n: number): number => {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n};\n```\n\n这样可以让代码更加健壮和可维护。",
];

/**
 * ✅ 生成大量测试消息（用于测试虚拟列表性能）
 * @param count 要生成的消息对数（一问一答为一对）
 * @param conversationId 会话ID
 * @returns 消息数组
 */
export function generateTestMessages(
  count: number = 100,
  conversationId: number = 1
): Message[] {
  const messages: Message[] = [];
  let idCounter = 1;

  for (let i = 0; i < count; i++) {
    const questionIndex = i % testQuestions.length;
    const answerIndex = i % testAnswers.length;

    // 添加问题
    messages.push({
      id: `test-msg-${idCounter++}`,
      content: testQuestions[questionIndex],
      createdAt: randomDate(startDate, endDate),
      updatedAt: randomDate(startDate, endDate),
      type: "question",
      conversationId: String(conversationId),
      status: "success",
      dirty: false,
    });

    // 添加回答
    messages.push({
      id: `test-msg-${idCounter++}`,
      content: testAnswers[answerIndex],
      createdAt: randomDate(startDate, endDate),
      updatedAt: randomDate(startDate, endDate),
      type: "answer",
      conversationId: String(conversationId),
      status: "success",
      dirty: false,
    });
  }

  return messages;
}

export const messages: Message[] = [
  // 会话1
  {
    id: "1",
    content: "什么是光合作用？能简单介绍一下吗？",
    createdAt: randomDate(startDate, endDate),
    updatedAt: randomDate(startDate, endDate),
    type: "question",
    conversationId: "1",
    dirty: false,
  },
  {
    id: "2",
    content:
      "光合作用是绿色植物、藻类和某些细菌利用叶绿素吸收光能，将二氧化碳和水转化为有机物并释放氧气的过程。这是地球上几乎所有生命能量的来源。",
    createdAt: randomDate(startDate, endDate),
    updatedAt: randomDate(startDate, endDate),
    type: "answer",
    conversationId: "1",
    dirty: false,
  },
  {
    id: "3",
    content: "光合作用的具体过程是怎样的？有哪些关键步骤？",
    createdAt: randomDate(startDate, endDate),
    updatedAt: randomDate(startDate, endDate),
    type: "question",
    conversationId: "1",
    dirty: false,
  },
  {
    id: "4",
    content:
      "光合作用分为光反应和暗反应两个阶段。光反应发生在类囊体膜上，通过光解水产生氧气、ATP和NADPH；暗反应（卡尔文循环）发生在叶绿体基质中，利用这些能量将二氧化碳固定成有机物。",
    createdAt: randomDate(startDate, endDate),
    updatedAt: randomDate(startDate, endDate),
    type: "answer",
    conversationId: "1",
    dirty: false,
  },
  {
    id: "5",
    content: "哪些因素会影响光合作用的效率？",
    createdAt: randomDate(startDate, endDate),
    type: "question",
    updatedAt: randomDate(startDate, endDate),
    conversationId: "1",
    dirty: false,
  },
  {
    id: "6",
    content: "",
    createdAt: randomDate(startDate, endDate),
    updatedAt: randomDate(startDate, endDate),
    type: "answer",
    status: "loading",
    conversationId: "1",
    dirty: false,
  },

  // 会话2
  {
    id: "7",
    content: "人工智能目前的发展趋势是什么？",
    createdAt: randomDate(startDate, endDate),
    updatedAt: randomDate(startDate, endDate),
    type: "question",
    conversationId: "2",
    dirty: false,
  },
  {
    id: "8",
    content:
      "当前AI发展呈现出大模型、多模态融合、低代码化、专用化等趋势。大语言模型如GPT、Claude等能力持续提升，同时AI在医疗、金融、教育等垂直领域的应用也日益深入。",
    createdAt: randomDate(startDate, endDate),
    updatedAt: randomDate(startDate, endDate),
    type: "answer",
    conversationId: "2",
    dirty: false,
  },
  {
    id: "9",
    content: "AI技术在医疗领域有哪些具体应用？",
    createdAt: randomDate(startDate, endDate),
    updatedAt: randomDate(startDate, endDate),
    type: "question",
    conversationId: "2",
    dirty: false,
  },
  {
    id: "10",
    content:
      "AI在医疗领域的应用非常广泛，包括医学影像诊断、药物研发、智能病历管理、个性化治疗方案制定等。例如，深度学习算法已能在某些癌症筛查中达到甚至超过专业医生的水平。",
    createdAt: randomDate(startDate, endDate),
    updatedAt: randomDate(startDate, endDate),
    type: "answer",
    conversationId: "2",
    dirty: false,
  },

  // 会话3
  {
    id: "11",
    content: "量子计算和传统计算有什么本质区别？",
    createdAt: randomDate(startDate, endDate),
    type: "question",
    updatedAt: randomDate(startDate, endDate),
    conversationId: "3",
    dirty: false,
  },
  {
    id: "12",
    content: "",
    createdAt: randomDate(startDate, endDate),
    updatedAt: randomDate(startDate, endDate),
    type: "answer",
    status: "loading",
    conversationId: "3",
    dirty: false,
  },
];

// export const conversations: Conversation[] = [
//   {
//     id: "1",
//     selectedModel: "ERNIE-4.0-8K",
//     title: "光合作用基本原理详解",
//     createdAt: randomDate(startDate, endDate),
//     updatedAt: randomDate(startDate, endDate),
//     providerId: "1",
//     pinned: true,
//     dirty: false,
//   },
//   {
//     id: "2",
//     selectedModel: "qwen-plus",
//     title: "人工智能发展趋势与应用",
//     createdAt: randomDate(startDate, endDate),
//     updatedAt: randomDate(startDate, endDate),
//     providerId: "2",
//     pinned: false,
//     dirty: false,
//   },
//   {
//     id: "3",
//     selectedModel: "deepseek-chat",
//     title: "量子计算基础概念解析",
//     createdAt: randomDate(startDate, endDate),
//     updatedAt: randomDate(startDate, endDate),
//     providerId: "3",
//     pinned: false,
//     dirty: false,
//   },
// ];
