import { createReadStream, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const TYPES: Record<string, string> = { json: "application/json; charset=utf-8", bin: "application/octet-stream" };

/** The dev server's /data: the local catalog (catalog/<model>/…), answering a single HTTP range as R2
 * does live. The build leaves it out; the site reads the catalog from the data origin (src/lib/data.ts). */
export function serveCatalog(root = fileURLToPath(new URL("../../catalog", import.meta.url))): Plugin {
  return {
    name: "serve-catalog",
    configureServer(server) {
      server.middlewares.use("/data", (request, response, next) => {
        const path = resolve(root, `.${decodeURIComponent((request.url ?? "/").split("?")[0])}`);
        if (!path.startsWith(root + sep)) return next();
        let size: number;
        try {
          const stat = statSync(path);
          if (!stat.isFile()) throw new Error("not a file");
          size = stat.size;
        } catch {
          response.statusCode = 404;
          return response.end();
        }
        response.setHeader("Content-Type", TYPES[path.split(".").pop() ?? ""] ?? "application/octet-stream");
        response.setHeader("Accept-Ranges", "bytes");
        const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? "");
        let [start, end] = [0, size - 1];
        if (range) {
          [start, end] = [Number(range[1]), Math.min(range[2] ? Number(range[2]) : size - 1, size - 1)];
          if (start > end) {
            response.statusCode = 416;
            response.setHeader("Content-Range", `bytes */${size}`);
            return response.end();
          }
          response.statusCode = 206;
          response.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
        }
        response.setHeader("Content-Length", end - start + 1);
        if (request.method === "HEAD" || size === 0) return response.end();
        createReadStream(path, { start, end }).pipe(response);
      });
    },
  };
}
