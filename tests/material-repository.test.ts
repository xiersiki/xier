// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MaterialRepository } from "../main/materials/repository";
const directories: string[] = [];
const repositories: MaterialRepository[] = [];
function open() {
  const dir = mkdtempSync(join(tmpdir(), "xier-repository-"));
  directories.push(dir);
  const repository = new MaterialRepository(join(dir, "materials.sqlite"));
  repositories.push(repository);
  return repository;
}
afterEach(() => {
  repositories.forEach((r) => {
    try {
      r.close();
    } catch {}
  });
  directories.forEach((d) => rmSync(d, { recursive: true, force: true }));
});
it("persists an import outcome and its exact raw copy atomically, with a completed last item", () => {
  const r = open();
  r.startImport("request-1", "digest-1", [{ name: "笔记.md", size: 9 }]);
  r.completeItem("request-1", 0, Buffer.from("正文"), "正文");
  expect(r.getImport("request-1")).toMatchObject({
    status: "completed",
    items: [{ status: "imported", name: "笔记.md" }],
  });
  const id = r.getImport("request-1")!.items[0].documentId!;
  expect(r.readText(id, 0)).toMatchObject({ text: "正文", nextOffset: null });
  expect(r.copyText(id)).toBe("正文");
  expect(r.usage()).toEqual({ documents: 1, bytes: 6 });
});
it("replays the same request safely, deduplicates bytes and retains history when a copy is removed", () => {
  const r = open();
  const files = [
    { name: "first.txt", size: 3 },
    { name: "again.md", size: 3 },
  ];
  r.startImport("one", "hash", files);
  expect(r.startImport("one", "hash", files).requestId).toBe("one");
  expect(() => r.startImport("one", "changed", files)).toThrow(
    "REQUEST_CONFLICT",
  );
  expect(() => r.startImport("two", "other", files)).toThrow("BUSY");
  r.completeItem("one", 0, Buffer.from("abc"), "abc");
  r.completeItem("one", 1, Buffer.from("abc"), "abc");
  expect(r.getImport("one")).toMatchObject({
    status: "completed",
    items: [{ status: "imported", name: "first.txt" }, { status: "duplicate" }],
  });
  const id = r.getImport("one")!.items[0].documentId!;
  expect(r.usage()).toEqual({ documents: 1, bytes: 3 });
  r.removeMaterial(id);
  expect(r.usage()).toEqual({ documents: 0, bytes: 0 });
  expect(r.getImport("one")!.items[0].removed).toBe(true);
  expect(() => r.copyText(id)).toThrow("NOT_FOUND");
  expect(r.listImports().items).toHaveLength(1);
});
it("confirms cancellation durably and recovers only unfinished work after reopening", () => {
  const r = open();
  r.startImport("stop", "stop", [
    { name: "a.txt", size: 3 },
    { name: "b.txt", size: 3 },
  ]);
  r.completeItem("stop", 0, Buffer.from("abc"), "abc");
  expect(r.cancelImport("stop").status).toBe("cancelled");
  expect(() => r.completeItem("stop", 1, Buffer.from("def"), "def")).toThrow(
    "JOB_TERMINAL",
  );
  expect(r.usage().documents).toBe(1);
  r.startImport("crash", "crash", [{ name: "c.txt", size: 3 }]);
  r.recover();
  expect(r.getImport("crash")).toMatchObject({
    status: "interrupted",
    items: [{ status: "interrupted" }],
  });
  r.startImport("failure", "failure", [{ name: "bad.txt", size: 1 }]);
  r.failItem("failure", 0, "INVALID_UTF8");
  expect(r.getImport("failure")).toMatchObject({
    status: "completed",
    items: [{ status: "failed", error: "INVALID_UTF8" }],
  });
  expect(r.cancelImport("failure").status).toBe("completed");
});
it("searches literal Unicode substrings without evaluating FTS operators and invalidates stale pages", async () => {
  const r = open();
  for (const [id, name, text] of [
    ["a", "中文.txt", "React 😀 a+b <script>alert(1)</script>"],
    ["b", "other.md", "foo NOT bar café"],
    ["c", "界.txt", "面分离"],
  ]) {
    r.startImport(id, id, [{ name, size: 99 }]);
    r.completeItem(id, 0, Buffer.from(text), text);
  }
  for (const [text, names] of [
    ["中", ["中文.txt"]],
    ["😀", ["中文.txt"]],
    ["A+B", ["中文.txt"]],
    ["foo NOT bar", ["other.md"]],
    ["cafe\u0301", ["other.md"]],
    ["界面", []],
  ]) {
    expect(
      (await r.search({ queryId: String(text), text: String(text) })).items.map(
        (i) => i.name,
      ),
    ).toEqual(names);
  }
  expect(() => r.readText("missing", 0)).toThrow("NOT_FOUND");
  await expect(
    r.search({ queryId: "bad", text: "a".repeat(129) }),
  ).rejects.toThrow("INVALID_QUERY");
  r.cancelSearch("cancelled");
  await expect(r.search({ queryId: "cancelled", text: "中" })).rejects.toThrow(
    "CANCELLED",
  );
});
it("enforces the document quota while allowing duplicates and keeps pagination stable until a mutation", async () => {
  const r = open();
  for (let i = 0; i < 500; i++) {
    const text = `document-${i}`;
    r.startImport(`job-${i}`, `${i}`, [
      { name: `${i}.txt`, size: text.length },
    ]);
    r.completeItem(`job-${i}`, 0, Buffer.from(text), text);
  }
  const first = await r.search({ queryId: "page", text: "" });
  expect(first.items).toHaveLength(50);
  expect(first.cursor).toBeTruthy();
  const second = await r.search({
    queryId: "page2",
    text: "",
    cursor: first.cursor!,
  });
  expect(second.items).toHaveLength(50);
  expect(new Set([...first.items, ...second.items].map((i) => i.id)).size).toBe(
    100,
  );
  r.startImport("duplicate", "d", [{ name: "again.txt", size: 10 }]);
  r.completeItem("duplicate", 0, Buffer.from("document-0"), "document-0");
  expect(r.getImport("duplicate")!.items[0].status).toBe("duplicate");
  r.startImport("overflow", "o", [{ name: "overflow.txt", size: 8 }]);
  expect(() =>
    r.completeItem("overflow", 0, Buffer.from("overflow"), "overflow"),
  ).toThrow("LIBRARY_QUOTA");
  expect(r.usage().documents).toBe(500);
  r.removeMaterial(first.items[0].id);
  await expect(
    r.search({ queryId: "stale", text: "", cursor: first.cursor! }),
  ).rejects.toThrow("STALE_CURSOR");
});
it("accepts 128 original Unicode code points even when lowercase expands them", async () => {
  const r = open();
  const text = "İ".repeat(128);
  r.startImport("unicode", "u", [{ name: "unicode.txt", size: 256 }]);
  r.completeItem("unicode", 0, Buffer.from(text), text);
  expect(
    (await r.search({ queryId: "unicode", text })).items.map((i) => i.name),
  ).toEqual(["unicode.txt"]);
});
it("bounds task history responses by bytes as well as twenty jobs without losing pagination entries", () => {
  const r = open();
  for (let index = 0; index < 21; index++) {
    const id = `history-${index}`;
    r.startImport(
      id,
      id,
      Array.from({ length: 100 }, (_, item) => ({
        name: `${"a".repeat(230)}-${item}.txt`,
        size: 1,
      })),
    );
    r.cancelImport(id);
  }
  let cursor: string | undefined;
  const ids: string[] = [];
  do {
    const page = r.listImports({ cursor });
    expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(
      256 * 1024,
    );
    expect(page.items.length).toBeLessThanOrEqual(20);
    ids.push(...page.items.map((job) => job.requestId));
    cursor = page.cursor ?? undefined;
  } while (cursor);
  expect(ids).toHaveLength(21);
  expect(new Set(ids).size).toBe(21);
});
it("rejects ill-formed Unicode rather than converting a surrogate query to a replacement-character match", async () => {
  const r = open();
  r.startImport("replacement", "r", [{ name: "replacement.txt", size: 3 }]);
  r.completeItem("replacement", 0, Buffer.from("�"), "�");
  for (const text of ["\ud800", "\udc00"])
    await expect(
      r.search({ queryId: crypto.randomUUID(), text }),
    ).rejects.toThrow("INVALID_QUERY");
  expect(
    (await r.search({ queryId: "literal-replacement", text: "�" })).items.map(
      (i) => i.name,
    ),
  ).toEqual(["replacement.txt"]);
});
