import { createReadStream } from "node:fs";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_FILE = path.join(ROOT, "data/photos.json");
const START_PORT = Number(process.env.PORT || 8000);
const MAX_PORT_ATTEMPTS = 20;
const MAX_BODY_SIZE = 16 * 1024;

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
    if (request.url?.startsWith("/api/")) {
      await handleApiRequest(request, response);
      return;
    }

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

async function handleApiRequest(request, response) {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, { error: "Local requests only" });
    return;
  }

  const parsedUrl = new URL(request.url, `http://localhost:${START_PORT}`);
  const match = parsedUrl.pathname.match(/^\/api\/photos\/(\d+)\/description$/);

  if (request.method !== "PUT" || !match) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  const id = Number(match[1]);
  const body = await readJsonBody(request);

  if (typeof body.description !== "string") {
    sendJson(response, 400, { error: "description must be a string" });
    return;
  }

  const photos = await readPhotoRecords();
  const photo = photos.find((item) => item.id === id);

  if (!photo) {
    sendJson(response, 404, { error: `Photo ${id} not found` });
    return;
  }

  photo.description = body.description.trim();
  await writePhotoRecords(photos);
  sendJson(response, 200, { photo });
}

function isLocalRequest(request) {
  const remoteAddress = request.socket.remoteAddress;
  return remoteAddress === "::1" || remoteAddress === "127.0.0.1" || remoteAddress === "::ffff:127.0.0.1";
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > MAX_BODY_SIZE) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

async function readPhotoRecords() {
  try {
    const json = await readFile(DATA_FILE, "utf8");
    return JSON.parse(json);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writePhotoRecords(records) {
  await writeFile(`${DATA_FILE}.tmp`, `${JSON.stringify(records, null, 2)}\n`);
  await rename(`${DATA_FILE}.tmp`, DATA_FILE);
}

function sendJson(response, statusCode, data) {
  const body = JSON.stringify(data);

  response.writeHead(statusCode, {
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(body);
}
