// @vitest-environment node
import { expect, it } from "vitest";
import { mkdtemp, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authorizeFiles, readAuthorizedFile } from "../main/materials/files";
it("imports only unchanged ordinary UTF-8 text using a picker manifest and never modifies the source", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xier-files-"));
  try {
    const path = join(dir, "note.md");
    const raw = Buffer.from("\ufeff中文 😀");
    await writeFile(path, raw);
    const [file] = await authorizeFiles([path]);
    expect(await readAuthorizedFile(file, () => false)).toMatchObject({
      text: "中文 😀",
      raw,
    });
    expect(await readFile(path)).toEqual(raw);
    await writeFile(path, "changed");
    await expect(readAuthorizedFile(file, () => false)).rejects.toThrow(
      "SOURCE_CHANGED",
    );
    await writeFile(path, Buffer.from([0xff]));
    await expect(
      readAuthorizedFile((await authorizeFiles([path]))[0], () => false),
    ).rejects.toThrow("INVALID_UTF8");
    await writeFile(path, "zero\0byte");
    await expect(
      readAuthorizedFile((await authorizeFiles([path]))[0], () => false),
    ).rejects.toThrow("BINARY_FILE");
    await symlink(path, join(dir, "link.md"));
    expect((await authorizeFiles([join(dir, "link.md")]))[0].error).toBe(
      "NOT_REGULAR_FILE",
    );
    await expect(
      readAuthorizedFile((await authorizeFiles([path]))[0], () => true),
    ).rejects.toThrow("CANCELLED");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("keeps valid files in a mixed selection and reports invalid sources as individual outcomes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xier-mixed-"));
  try {
    const good = join(dir, "good.md"),
      empty = join(dir, "empty.txt");
    await writeFile(good, "保留内容");
    await writeFile(empty, "");
    const files = await authorizeFiles([empty, good, join(dir, "missing.txt")]);
    expect(files).toHaveLength(3);
    await expect(readAuthorizedFile(files[0], () => false)).rejects.toThrow(
      "EMPTY_FILE",
    );
    expect((await readAuthorizedFile(files[1], () => false)).text).toBe(
      "保留内容",
    );
    await expect(readAuthorizedFile(files[2], () => false)).rejects.toThrow(
      "FILE_UNREADABLE",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("accounts for every read chunk before decoding so a batch budget can abort unsuccessful reads", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xier-byte-budget-"));
  try {
    const path = join(dir, "source.txt");
    await writeFile(path, "x".repeat(130000));
    const [file] = await authorizeFiles([path]);
    let readBytes = 0;
    await expect(
      readAuthorizedFile(
        file,
        () => false,
        (bytes) => {
          readBytes += bytes;
          if (readBytes > 65536) throw new Error("BATCH_BYTE_LIMIT");
        },
      ),
    ).rejects.toThrow("BATCH_BYTE_LIMIT");
    expect(readBytes).toBeGreaterThan(65536);
    expect((await readFile(path)).length).toBe(130000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("explains a source removed or replaced by a symlink after selection as a source failure", async () => {
  const { unlink } = await import("node:fs/promises");
  const dir = await mkdtemp(join(tmpdir(), "xier-source-after-pick-"));
  try {
    const source = join(dir, "picked.md"),
      replacement = join(dir, "replacement.md");
    await writeFile(source, "picked content");
    await writeFile(replacement, "replacement content");
    const [file] = await authorizeFiles([source]);
    await unlink(source);
    await expect(readAuthorizedFile(file, () => false)).rejects.toThrow(
      "FILE_UNREADABLE",
    );
    await symlink(replacement, source);
    await expect(readAuthorizedFile(file, () => false)).rejects.toThrow(
      "SOURCE_CHANGED",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
