# 虚拟列表测试指南

## ✅ 已完成的功能

1. **虚拟列表实现**
   - 使用 `vue-virtual-scroller@next` (Vue 3 兼容版本)
   - 支持动态高度（根据消息内容自动调整）
   - 配置最小项高度 80px
   - 保留所有原有功能（批量操作、右键菜单、时间格式化）

2. **性能优化**
   - 只渲染可见区域的消息
   - 自动滚动到底部
   - 流式输出时平滑滚动

## 🧪 测试方法

### 方法 1：使用浏览器控制台生成测试数据（推荐）

1. 启动应用：
```bash
npm run start
```

2. 创建或打开一个对话

3. 打开开发者工具（F12），在控制台执行以下代码：

```javascript
// ✅ 简单方法：直接生成测试数据
(async () => {
  // 导入依赖
  const { dataBase } = await import('../dataBase.js');
  
  // 获取当前对话 ID
  const currentConvId = window.location.pathname.split('/').pop();
  if (!currentConvId) {
    console.error('请先打开一个对话！');
    return;
  }
  
  // 生成测试数据（100 对 = 200 条消息）
  const testMessages = [];
  const questions = [
    '什么是光合作用？',
    'AI 的发展趋势是什么？',
    '量子计算有什么优势？',
    'TypeScript 相比 JavaScript 的优势？',
    'Vue 3 有哪些新特性？',
    '如何优化前端性能？',
    '什么是虚拟列表？',
    'Electron 如何工作？',
    '响应式设计的原则是什么？',
    '什么是闭包？'
  ];
  
  const answers = [
    '这是一个详细的回答示例，包含了多行文本。\n\n首先，我们需要理解基本概念...',
    '根据目前的技术发展趋势，主要有以下几个方向：\n1. 大模型技术\n2. 多模态融合\n3. 边缘计算',
    '相比传统计算，量子计算具有以下优势：\n- 并行计算能力\n- 特定问题的指数级加速\n- 量子纠缠特性',
  ];
  
  let id = Date.now();
  for (let i = 0; i < 100; i++) {
    // 问题
    testMessages.push({
      id: `test-${id++}`,
      content: questions[i % questions.length],
      createdAt: Date.now() - (100 - i) * 60000,
      updatedAt: Date.now() - (100 - i) * 60000,
      type: 'question',
      conversationId: currentConvId,
      status: 'success',
      dirty: false
    });
    
    // 回答
    testMessages.push({
      id: `test-${id++}`,
      content: answers[i % answers.length],
      createdAt: Date.now() - (100 - i) * 60000 + 1000,
      updatedAt: Date.now() - (100 - i) * 60000 + 1000,
      type: 'answer',
      conversationId: currentConvId,
      status: 'success',
      dirty: false
    });
  }
  
  // 保存到数据库
  await dataBase.messages.bulkAdd(testMessages);
  console.log(`✅ 成功生成 ${testMessages.length} 条测试消息！`);
  
  // 刷新页面
  setTimeout(() => window.location.reload(), 500);
})();
```

### 方法 2：手动修改代码添加测试数据

在 `renderer/stores/messages.ts` 的 `initialize` 函数中临时添加：

```typescript
async function initialize(conversationId: string) {
  // ... 现有代码 ...
  
  // ✅ 临时添加：生成测试数据
  if (conversationId === '1') {
    const { generateTestMessages } = await import('../testData');
    const testData = generateTestMessages(100, conversationId);
    await dataBase.messages.bulkAdd(testData);
  }
  
  // ... 继续现有逻辑 ...
}
```

### 方法 3：通过 Dexie 数据库工具直接操作

1. 打开 Chrome DevTools
2. 进入 Application > IndexedDB > XierDB > messages
3. 手动添加消息记录

## 📊 性能测试指标

测试不同消息数量下的性能表现：

| 消息数量 | 传统列表 (DOM节点) | 虚拟列表 (DOM节点) | 性能提升 |
|---------|-------------------|-------------------|----------|
| 50 条   | ~50 个            | ~50 个            | 无明显差异 |
| 100 条  | ~100 个           | ~20 个            | 80% ↓ |
| 500 条  | ~500 个           | ~20 个            | 96% ↓ |
| 1000 条 | ~1000 个          | ~20 个            | 98% ↓ |

## ✨ 测试要点

### 1. 基本功能测试
- [ ] 消息正常显示（问题/回答样式正确）
- [ ] 时间格式化正常
- [ ] 自动滚动到底部
- [ ] Markdown 渲染正常

### 2. 虚拟列表特性测试
- [ ] 滚动流畅无卡顿
- [ ] 快速滚动时内容正确加载
- [ ] 高度动态调整（长短消息）
- [ ] 上下滚动时无闪烁

### 3. 交互功能测试
- [ ] 右键菜单（复制、删除、选择）
- [ ] 批量选择模式
- [ ] 批量删除功能
- [ ] 复制消息内容

### 4. 流式输出测试
- [ ] 流式消息自动滚动
- [ ] 流式消息高度自适应
- [ ] 流式消息结束后滚动停止

### 5. 性能测试
- [ ] 打开 Performance 监控面板
- [ ] 记录 FPS（应保持在 60fps）
- [ ] 观察内存占用（虚拟列表应显著降低）
- [ ] 滚动时 CPU 占用

## 🎯 预期结果

1. **100 条消息以下**：性能与原实现相当
2. **100-500 条消息**：明显性能提升，滚动流畅
3. **500+ 条消息**：传统列表会卡顿，虚拟列表依然流畅

## 🐛 已知问题

1. **TypeScript 类型警告**：
   - `template #default` 有类型警告
   - 不影响运行，可忽略或在 `tsconfig.json` 中添加 `skipLibCheck: true`

## 💡 优化建议

如果遇到性能问题，可以调整以下参数：

```vue
<DynamicScroller
  :items="messages"
  :min-item-size="80"  <!-- 调整预估高度，更接近实际高度性能越好 -->
  :buffer="200"        <!-- 添加缓冲区，提前渲染上下200px的内容 -->
>
```

## 📝 测试报告模板

测试环境：
- OS: Windows 11
- 浏览器: Electron (Chromium 版本)
- 消息数量: ___ 条
- 测试时间: ___

测试结果：
- 渲染性能: ⭐⭐⭐⭐⭐
- 滚动流畅度: ⭐⭐⭐⭐⭐
- 功能完整性: ⭐⭐⭐⭐⭐
- 内存占用: ___ MB

发现的问题：
1. ...
2. ...

改进建议：
1. ...
2. ...
