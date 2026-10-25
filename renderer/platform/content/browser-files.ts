import type { FilePort } from '../../../common/content/contracts';
/** Uses a read-only File snapshot; export always downloads a new file. */
export const browserFiles: FilePort = {
  async read(file) {
    if (!/\.(md|txt)$/i.test(file.name)) throw new Error('请选择 .md 或 .txt 文件');
    if (file.size > 100000) throw new Error('文件过大，请导入 20,000 字以内的 UTF-8 文本');
    return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
  },
  async export(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    try {
      const link = document.createElement('a'); link.href = url;
      link.download = /\.(md|txt)$/i.test(name) ? name : `${name}.md`; link.click();
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  },
  async copy(text) { await navigator.clipboard.writeText(text); },
};
