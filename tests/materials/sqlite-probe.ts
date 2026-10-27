import { DatabaseSync } from "node:sqlite";
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

process.parentPort.on("message", ({ ports }) => {
  const port = ports[0];
  port.on("message", ({ data }) => {
    if (data.method !== "ping") return;
    if (data.id === "control") {
      port.postMessage({ id: data.id, result: { pong: true } });
      return;
    }
    try {
      const db = new DatabaseSync(process.argv[2]);
      db.exec(
        "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE docs(id INTEGER PRIMARY KEY, raw BLOB, text TEXT); CREATE VIRTUAL TABLE search USING fts5(text, tokenize='trigram case_sensitive 1');",
      );
      const markers = [
        "中文学习资料 React Native 😀",
        "中文二字内容 Alpha BETA",
        '标点 a+b "+引号" İe\u0301',
      ];
      const normalize = (s: string) =>
        s.normalize("NFC").toLowerCase().normalize("NFC");
      let maxCommitMs = 0;
      for (let i = 0; i < markers.length; i++) {
        const text =
          markers[i] +
          "x".repeat(2 * 1024 * 1024 - Buffer.byteLength(markers[i]));
        const start = performance.now();
        db.exec("BEGIN IMMEDIATE");
        db.prepare("INSERT INTO docs VALUES(?,?,?)").run(
          i + 1,
          Buffer.from(text),
          normalize(text),
        );
        db.prepare("INSERT INTO search(rowid,text) VALUES(?,?)").run(
          i + 1,
          normalize(text),
        );
        db.exec("COMMIT");
        maxCommitMs = Math.max(maxCommitMs, performance.now() - start);
      }
      const queryCases = [
        "中",
        "中文",
        "学习资",
        "React",
        "native",
        "😀",
        "a+b",
        '"+引号"',
        "不存在",
        "İ",
        "é",
      ];
      let correct = 0;
      for (let i = 0; i < 100; i++) {
        const q = normalize(queryCases[i % queryCases.length]);
        const rows =
          Array.from(q).length >= 3
            ? db
                .prepare("SELECT rowid AS id FROM search WHERE search MATCH ?")
                .all('"' + q.replace(/"/g, '""') + '"')
            : db.prepare("SELECT id FROM docs WHERE instr(text, ?) > 0").all(q);
        const expected = markers.flatMap((m, j) =>
          normalize(m).includes(q) ? [j + 1] : [],
        );
        const ids = rows.map((row) => Number(row.id)).sort();
        if (JSON.stringify(ids) !== JSON.stringify(expected))
          throw new Error(`Query mismatch: ${q}`);
        correct++;
      }
      db.exec("BEGIN IMMEDIATE");
      db.prepare("INSERT INTO docs VALUES(99,?,?)").run(
        Buffer.from("rollback"),
        "rollback",
      );
      db.exec("ROLLBACK");
      const rollbackSafe =
        db.prepare("SELECT id FROM docs WHERE id=99").get() === undefined;
      const info = {
        protocolVersion: 1,
        process: "utility",
        electron: process.versions.electron,
        node: process.versions.node,
        sqlite: db.prepare("SELECT sqlite_version() AS version").get()?.version,
        journal: db.prepare("PRAGMA journal_mode").get()?.journal_mode,
        compileOptions: db.prepare("PRAGMA compile_options").all(),
        correctQueries: correct,
        maxCommitMs,
        rollbackSafe,
      };
      db.close();
      const reopened = new DatabaseSync(process.argv[2]);
      const result = {
        ...info,
        reopenedCount: reopened.prepare("SELECT count(*) AS n FROM docs").get()
          ?.n,
      };
      reopened.close();
      writeFileSync(
        join(process.env.XIER_MATERIAL_TEST_DIR!, "sqlite-result.json"),
        JSON.stringify(result),
      );
      port.postMessage({ id: data.id, result });
    } catch (e) {
      port.postMessage({ id: data.id, result: { error: String(e) } });
    }
  });
  port.start();
  port.postMessage({ type: "ready" });
});
