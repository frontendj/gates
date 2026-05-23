import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const START_PORT = Number(process.env.PORT || 8000);
const MAX_PORT_ATTEMPTS = 20;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const server = createServer(async (request, response) => {
  try {
    const filePath = await getFilePath(request.url);
    const fileStats = await stat(filePath);

    if (!fileStats.isFile()) {
      sendNotFound(response);
      return;
    }

    response.writeHead(200, {
      "Content-Length": fileStats.size,
      "Content-Type":
        contentTypes[path.extname(filePath).toLowerCase()] ||
        "application/octet-stream",
    });

    createReadStream(filePath).pipe(response);
  } catch {
    sendNotFound(response);
  }
});

for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
  const port = START_PORT + offset;

  try {
    await listen(port);
    console.log(`Serving Gates at http://localhost:${port}`);
    break;
  } catch (error) {
    if (error.code !== "EADDRINUSE" || offset === MAX_PORT_ATTEMPTS - 1) {
      throw error;
    }
  }
}

async function getFilePath(url = "/") {
  const parsedUrl = new URL(url, `http://localhost:${START_PORT}`);
  const decodedPath = decodeURIComponent(parsedUrl.pathname);
  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = path.resolve(ROOT, `.${requestedPath}`);

  if (!filePath.startsWith(ROOT)) {
    throw new Error("Path is outside project root");
  }

  return filePath;
}

function listen(port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function sendNotFound(response) {
  response.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end("Not found");
}
