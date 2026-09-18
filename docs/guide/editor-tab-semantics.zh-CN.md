# 编辑器 Tab 键语义（可视化 vs 源码）

Lunote 同一篇笔记有两种编辑界面。**Tab** 与 **Shift-Tab** 在两种模式下的行为不同：这是刻意设计——可视化模式编辑结构化文档，源码模式编辑纯 Markdown 文本。

## 速查表

| 场景 | 可视化模式（TipTap） | 源码模式（CodeMirror） |
|------|----------------------|------------------------|
| 无序 / 有序 / 待办列表 | **嵌套**或**提升**列表项（`sinkListItem` / `liftListItem`） | 在行首增加或删除 **4 个空格** |
| 段落 / 标题 | 在光标处插入 **4 个空格**（多行选区则每行缩进） | 同样在行首处理 **4 个空格** |
| 代码块（嵌入 CM） | CodeMirror：**4 空格**缩进 / 反缩进 | 围栏内：**4 空格**缩进 / 反缩进 |
| 表格单元格 | 由表格扩展处理（非普通空格 Tab） | 与可视化不同，不按列表规则 |
| Mermaid 源码岛 | Tab 被隔离（不缩进整篇文档） | — |

macOS 上使用 **Tab** / **Shift-Tab**；编辑器缩进不按平台改键。

## 可视化模式——结构优先

渲染后的编辑器里，列表是文档树中的真实列表，而不只是以 `-` 开头的行。

- **Tab**：尝试将当前项**嵌套**到上一项下方（加深一级）。
- **Shift-Tab**：尝试**提升**到父列表或变为普通段落。
- 若嵌套失败（例如待办 checkbox 边界），Tab 可能退化为在光标处插入 **四个空格**，避免焦点跳到复选框。

普通段落与标题不走列表嵌套：**Tab** 插入四个空格（多行选区则每行处理）。

### 块级全选（`Cmd+A` / `Ctrl+A`）

可视化模式下，**全选**是**按块**的，不是整篇文档：

| 块类型 | 选中范围 |
|--------|----------|
| 段落 / 标题 | 当前块内文本 |
| 列表项 / 待办项 | 当前项内文本 |
| Callout / 引用块 | 块内文本 |
| 代码块（CM 聚焦） | 嵌入编辑器中的全部代码 |
| 表格 | 当前单元格（或单元格选区） |

全选后可直接输入替换，或 Delete/Backspace 清空。

## 源码模式——Markdown 优先

源码模式显示**磁盘上的 Markdown**。Tab 不改变 ProseMirror 列表树，只改**字符**：

- **Tab**：在列表行行首增加 **四个空格**（Markdown 嵌套列表约定）。
- **Shift-Tab**：删除行首最多四个空格。
- 普通段落无前导空格时，**Shift-Tab** 无效果。

**可视化 ↔ 源码** 往返会保留内容，但：在可视化里用 Tab 得到的嵌套存为**结构**；在源码里用 Tab 得到的嵌套存为**前导空格**。两者都是合法 Markdown，通常能正确往返，但**操作手感**不同。

## 使用建议

1. 需要 Obsidian/Typora 式列表嵌套时，优先在**可视化模式**按 Tab。
2. 需要对齐原始 Markdown（粘贴缩进片段、修 README 代码块）时，优先**源码模式** Tab。
3. 模式切换后若列表层级看起来不对，检查是否混用了两种 Tab 语义，待办列表与深层嵌套尤需注意。
4. **嵌入代码块**在 CM 聚焦时，无论整篇处于哪种模式，都走 CodeMirror 的 Tab 规则。
5. **`Cmd+/` / `Ctrl+/`** 切换的是**整篇文档**的可视化 / 源码模式，不会只切换某个代码块、Mermaid 或公式岛。

## 相关文档

- [快捷键与菜单](shortcuts-and-menus.md)——模式切换（**`Cmd+/`** / **`Ctrl+/`**）、全选、剪贴板
- [平台差异](platform-differences.md)——各系统快捷键显示
- 模式切换回归：`npm run test:mode-switch`、`npm run test:mode-switch-contract`

## 自动化测试

| 测试 | 验证内容 |
|------|----------|
| `scripts/test/document-editor/document-list-interaction.spec.ts` | 可视化列表 Tab / Shift-Tab / 粘贴 |
| `scripts/test/document-editor/document-block-select-all.spec.ts` | 列表项与 Callout 的 Mod+A |
| `scripts/test/mode-switch/mode-switch-tab-semantics.spec.ts` | 可视化嵌套 vs 源码空格缩进 |
| `scripts/test/document-editor/document-tab-indent.spec.ts` | 可视化段落 Tab |
