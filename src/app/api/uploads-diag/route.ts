// TEMPORÁRIO — diagnóstico de uploads no volume. Remover após investigar.
import {
  readdir,
  stat,
  writeFile,
  readFile,
  mkdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cwd = process.cwd();
  const uploads = path.join(cwd, "public", "uploads");
  const logos = path.join(uploads, "logos");
  const report: Record<string, unknown> = { cwd, uploads, logos };

  async function info(p: string) {
    try {
      const s = await stat(p);
      return {
        exists: true,
        isDir: s.isDirectory(),
        mode: (s.mode & 0o777).toString(8),
        uid: s.uid,
        gid: s.gid,
      };
    } catch (e) {
      return { exists: false, err: (e as NodeJS.ErrnoException).code };
    }
  }

  report.processUid =
    typeof process.getuid === "function" ? process.getuid() : "n/a";
  report.uploadsStat = await info(uploads);
  report.logosStat = await info(logos);

  try {
    report.logosList = await readdir(logos);
  } catch (e) {
    report.logosListErr = (e as NodeJS.ErrnoException).code;
  }

  try {
    await mkdir(logos, { recursive: true });
    const f = path.join(logos, ".diag-test.txt");
    await writeFile(f, "ok");
    report.readBack = (await readFile(f)).toString();
    report.writeTest = "OK";
    await unlink(f);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    report.writeTest = "FAIL";
    report.writeErr = `${err.code}: ${err.message}`;
  }

  return NextResponse.json(report);
}
