import {
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import exifr from "exifr";
import sharp from "sharp";

const DATA_FILE = "data/photos.json";
const PHOTOS_DIR = "photos";
const DEFAULT_INPUT_DIR = "incoming";
const DONE_DIR = "incoming/done";
const FULL_MAX_SIZE = 2400;
const PREVIEW_MAX_SIZE = 800;
const FULL_QUALITY = 86;
const PREVIEW_QUALITY = 78;
const IMPORTABLE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
]);

const options = parseArgs(process.argv.slice(2));
const shouldGeocode = !options.flags.has("no-geocode");
const shouldGroupImport = options.flags.has("grouping");
const requestedLocationPrecision = Number(options.values.get("location-precision") || 5);
const locationPrecision = Number.isInteger(requestedLocationPrecision)
  ? Math.min(Math.max(requestedLocationPrecision, 0), 6)
  : 5;
const groupRoles = (options.values.get("roles") || "")
  .split(",")
  .map((role) => role.trim())
  .filter(Boolean);
const inputArg = options.positionals[0] || DEFAULT_INPUT_DIR;

async function main() {
  await ensureDirectories();

  const sources = await getSourceFiles(inputArg);

  if (sources.length === 0) {
    console.log(`No importable photos found in ${inputArg}.`);
    return;
  }

  const records = await readPhotoRecords();
  let nextId = await getNextId(records);
  const explicitGroupId = shouldGroupImport ? `g-${nextId}` : "";
  const imported = [];

  for (const [index, source] of sources.entries()) {
    const id = nextId;
    nextId += 1;

    console.log(`Importing ${source} as #${id}...`);

    const metadata = await readImageMetadata(source);
    await writeGalleryImages(source, id);

    const record = await createPhotoRecord(id, source, metadata, {
      groupId: getGroupId(imported, id, metadata, explicitGroupId),
      groupRole: groupRoles[index],
    });
    records.push(record);

    await moveSourceToDone(source, id);
    imported.push(record);

    if (shouldGeocode && imported.length < sources.length) {
      await wait(1100);
    }
  }

  await writePhotoRecords(records);

  console.log(
    `Imported ${imported.length} photo${imported.length === 1 ? "" : "s"}.`,
  );
  for (const record of imported) {
    console.log(`#${record.id}: ${record.location || "location unknown"}`);
  }
  logDetectedGroups(imported);
}

async function ensureDirectories() {
  await Promise.all([
    mkdir(PHOTOS_DIR, { recursive: true }),
    mkdir(DEFAULT_INPUT_DIR, { recursive: true }),
    mkdir(DONE_DIR, { recursive: true }),
  ]);
}

async function getSourceFiles(inputPath) {
  const stats = await stat(inputPath).catch(() => null);

  if (!stats) {
    return [];
  }

  if (stats.isFile()) {
    return isImportableImage(inputPath) ? [inputPath] : [];
  }

  if (!stats.isDirectory()) {
    return [];
  }

  const entries = await readdir(inputPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(inputPath, entry.name))
    .filter(isImportableImage)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function isImportableImage(filePath) {
  return IMPORTABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function parseArgs(rawArgs) {
  const flags = new Set();
  const values = new Map();
  const positionals = [];
  const valueFlags = new Set(["roles", "location-precision"]);

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--") {
      continue;
    }

    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const [rawName, inlineValue] = arg.slice(2).split("=", 2);

    if (valueFlags.has(rawName)) {
      const nextArg = rawArgs[index + 1];
      const value = inlineValue ?? (!nextArg?.startsWith("--") ? nextArg : "");
      values.set(rawName, value);

      if (inlineValue === undefined && value) {
        index += 1;
      }
    } else {
      flags.add(rawName);
    }
  }

  return {
    flags,
    values,
    positionals,
  };
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

async function getNextId(records) {
  const dataIds = records.map((record) => record.id).filter(Number.isFinite);
  const imageIds = await getExistingImageIds();
  return Math.max(0, ...dataIds, ...imageIds) + 1;
}

async function getExistingImageIds() {
  const entries = await readdir(PHOTOS_DIR).catch(() => []);

  return entries
    .map((entry) => entry.match(/^(\d+)(?:-sm)?\.jpe?g$/i))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
}

async function readImageMetadata(source) {
  const [tags, gps] = await Promise.all([
    exifr
      .parse(source, {
        exif: true,
        gps: true,
        tiff: true,
        ifd0: true,
        pick: ["DateTimeOriginal", "CreateDate", "ModifyDate", "Make", "Model"],
      })
      .catch(() => null),
    exifr.gps(source).catch(() => null),
  ]);

  return {
    date: formatExifDate(
      tags?.DateTimeOriginal || tags?.CreateDate || tags?.ModifyDate,
    ),
    latitude: gps?.latitude,
    longitude: gps?.longitude,
    camera: [tags?.Make, tags?.Model].filter(Boolean).join(" ").trim(),
  };
}

async function writeGalleryImages(source, id) {
  const image = sharp(source, { failOn: "none" }).rotate();

  await image
    .clone()
    .resize({
      width: FULL_MAX_SIZE,
      height: FULL_MAX_SIZE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: FULL_QUALITY,
      mozjpeg: true,
    })
    .toFile(path.join(PHOTOS_DIR, `${id}.jpg`));

  await image
    .clone()
    .resize({
      width: PREVIEW_MAX_SIZE,
      height: PREVIEW_MAX_SIZE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: PREVIEW_QUALITY,
      mozjpeg: true,
    })
    .toFile(path.join(PHOTOS_DIR, `${id}-sm.jpg`));
}

async function createPhotoRecord(id, source, metadata, groupOptions = {}) {
  const record = {
    id,
    originalName: path.basename(source),
  };
  const coordinates = getCoordinates(metadata);

  if (metadata.date) {
    record.date = metadata.date;
  }

  if (coordinates) {
    record.latitude = coordinates.latitude;
    record.longitude = coordinates.longitude;

    if (shouldGeocode) {
      const location = await reverseGeocode(coordinates);
      if (location) {
        record.location = location;
      }
    }
  }

  if (metadata.camera) {
    record.camera = metadata.camera;
  }

  if (groupOptions.groupId) {
    record.groupId = groupOptions.groupId;
  }

  if (groupOptions.groupRole) {
    record.groupRole = groupOptions.groupRole;
  }

  record.description = "";
  return record;
}

function getGroupId(importedRecords, id, metadata, explicitGroupId) {
  if (explicitGroupId) {
    return explicitGroupId;
  }

  const coordinates = getCoordinates(metadata);

  if (!coordinates) {
    return "";
  }

  const locationKey = getLocationKey(coordinates);
  const matches = importedRecords.filter((record) => getLocationKey(record) === locationKey);

  if (matches.length === 0) {
    return "";
  }

  const existingGroupId = matches.find((record) => record.groupId)?.groupId;
  const groupId = existingGroupId || `g-${matches[0].id}`;

  for (const match of matches) {
    match.groupId ||= groupId;
  }

  return groupId;
}

function logDetectedGroups(imported) {
  const groups = new Map();

  for (const record of imported) {
    if (!record.groupId) {
      continue;
    }

    if (!groups.has(record.groupId)) {
      groups.set(record.groupId, []);
    }

    groups.get(record.groupId).push(record);
  }

  for (const [groupId, groupRecords] of groups) {
    if (groupRecords.length < 2) {
      continue;
    }

    const ids = groupRecords.map((record) => `#${record.id}`).join(", ");
    const locationKey = getLocationKey(groupRecords[0]);
    const reason = shouldGroupImport
      ? "explicit --grouping import"
      : `matching GPS location ${locationKey}`;
    console.log(`Detected group ${groupId}: ${ids} (${reason}).`);
  }
}

function getCoordinates(metadata) {
  if (
    !Number.isFinite(metadata.latitude) ||
    !Number.isFinite(metadata.longitude)
  ) {
    return null;
  }

  return {
    latitude: Number(metadata.latitude.toFixed(6)),
    longitude: Number(metadata.longitude.toFixed(6)),
  };
}

function getLocationKey(record) {
  if (!Number.isFinite(record.latitude) || !Number.isFinite(record.longitude)) {
    return "";
  }

  return `${record.latitude.toFixed(locationPrecision)},${record.longitude.toFixed(locationPrecision)}`;
}

async function reverseGeocode({ latitude, longitude }) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "16");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "gates-photo-importer/1.0",
      },
    });

    if (!response.ok) {
      return "";
    }

    const place = await response.json();
    return place.display_name || "";
  } catch {
    return "";
  }
}

async function moveSourceToDone(source, id) {
  const extension = path.extname(source).toLowerCase();
  await rename(source, path.join(DONE_DIR, `${id}-source${extension}`));
}

function formatExifDate(value) {
  if (!value) {
    return "";
  }

  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const match = text.match(/^(\d{4})[:/-](\d{2})[:/-](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
