import { lstat, open } from "node:fs/promises";
import { constants, type Stats } from "node:fs";
import { basename, extname } from "node:path";
import { setImmediate as yieldTurn } from "node:timers/promises";
import { MATERIAL_LIMITS } from "../../common/materials";
export interface AuthorizedFile {
  path: string;
  name: string;
  size: number;
  fingerprint: string;
  error?: string;
}
function fingerprint(stat: Stats) {
  return [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(":");
}
export async function authorizeFiles(
  paths: string[],
): Promise<AuthorizedFile[]> {
  if (!paths.length || paths.length > MATERIAL_LIMITS.batchFiles)
    throw new Error("BATCH_FILE_LIMIT");
  const files: AuthorizedFile[] = [];
  let bytes = 0;
  for (const path of paths) {
    const file: AuthorizedFile = {
      path,
      name: basename(path),
      size: 0,
      fingerprint: "",
    };
    try {
      const stat = await lstat(path);
      file.size = stat.isFile() ? stat.size : 0;
      file.fingerprint = fingerprint(stat);
      if (!stat.isFile()) file.error = "NOT_REGULAR_FILE";
      else if (
        ![".txt", ".md", ".markdown"].includes(extname(path).toLowerCase())
      )
        file.error = "UNSUPPORTED_FILE";
      else if (!stat.size) file.error = "EMPTY_FILE";
      else if (stat.size > MATERIAL_LIMITS.fileBytes)
        file.error = "FILE_TOO_LARGE";
    } catch {
      file.error = "FILE_UNREADABLE";
    }
    bytes += file.size;
    if (bytes > MATERIAL_LIMITS.batchBytes) throw new Error("BATCH_BYTE_LIMIT");
    files.push(file);
  }
  return files;
}
export async function readAuthorizedFile(
  file: AuthorizedFile,
  cancelled: () => boolean,
  onRead: (bytes: number) => void = () => {},
) {
  if (cancelled()) throw new Error("CANCELLED");
  if (file.error) throw new Error(file.error);
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(
      file.path,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );
  } catch (error) {
    // A picker-authorized source may disappear or become a symlink before open.
    // Keep source diagnostics distinct from failures writing the library database.
    throw new Error(
      (error as NodeJS.ErrnoException).code === "ELOOP"
        ? "SOURCE_CHANGED"
        : "FILE_UNREADABLE",
    );
  }
  try {
    const before = await handle.stat();
    if (!before.isFile() || fingerprint(before) !== file.fingerprint)
      throw new Error("SOURCE_CHANGED");
    const chunks: Buffer[] = [];
    let bytes = 0;
    let text = "";
    const decoder = new TextDecoder("utf-8", { fatal: true });
    while (true) {
      if (cancelled()) throw new Error("CANCELLED");
      const chunk = Buffer.allocUnsafe(64 * 1024);
      const result = await handle.read(chunk, 0, chunk.length, null);
      if (!result.bytesRead) break;
      onRead(result.bytesRead);
      bytes += result.bytesRead;
      if (bytes > MATERIAL_LIMITS.fileBytes) throw new Error("FILE_TOO_LARGE");
      const part = chunk.subarray(0, result.bytesRead);
      chunks.push(part);
      try {
        text += decoder.decode(part, { stream: true });
      } catch {
        throw new Error("INVALID_UTF8");
      }
      await yieldTurn();
    }
    try {
      text += decoder.decode();
    } catch {
      throw new Error("INVALID_UTF8");
    }
    if (!bytes || !text.length) throw new Error("EMPTY_FILE");
    if (text.includes("\0")) throw new Error("BINARY_FILE");
    const after = await handle.stat();
    if (bytes !== file.size || fingerprint(after) !== file.fingerprint)
      throw new Error("SOURCE_CHANGED");
    return { raw: Buffer.concat(chunks), text };
  } finally {
    await handle.close();
  }
}
