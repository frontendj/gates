# Gates

A small static gallery for photos of gates that allow some kinds of passage while blocking others.

Deployed at: http://frontendj.github.io/gates

## Run The Website

```sh
pnpm serve
```

Then open `http://localhost:8000`.

If port `8000` is busy, the server will automatically try the next available port and print the URL.

## Edit Descriptions Locally

When the site is opened from `pnpm serve` on `localhost`, each photo card shows a description editor.
Descriptions save on blur, Shift+Enter, or 3 seconds after you stop typing. If a card represents a group, this edits the first photo in that group.

You can also edit the current photo description in the full-screen viewer. This is useful for grouped photos where each open/closed/detail state needs its own note.

The deployed GitHub Pages site is read-only.

To preview the read-only public mode locally, open the local site with `?mode=view`.

## Add Photos

Drop one or more photos into `incoming/`, then run:

```sh
pnpm import-photo
```

The import script will:

- Find the next numeric photo ID.
- Store the source filename as `originalName` for future reference.
- Extract EXIF date, GPS coordinates, and camera model when available.
- Reverse-geocode GPS coordinates into a human-readable `location` when possible.
- Group photos from the current import batch when they have matching rounded GPS coordinates.
- Write an optimized full image to `photos/{id}.jpg`.
- Write a smaller preview image to `photos/{id}-sm.jpg`.
- Add a record to `data/photos.json`.
- Move the source photo to `incoming/done/{id}-source.{ext}`.

If you want to skip reverse geocoding, run:

```sh
pnpm import-photo -- --no-geocode
```

You can also import a specific file or folder:

```sh
pnpm import-photo -- path/to/photo.jpg
pnpm import-photo -- path/to/folder
```

## Group Related Photos

Related photos stay as normal records in `data/photos.json`, with optional grouping fields:

```json
{
  "id": 12,
  "groupId": "g-12",
  "groupRole": "open",
  "originalName": "20200922_151233.jpg",
  "description": "Gate open"
}
```

Photos with the same `groupId` appear as one gallery card. The card uses the first photo as the cover and shows `+N` for the remaining photos. Opening the card lets you move through the grouped photos in full-screen mode.

To import all current input photos as one group:

```sh
pnpm import-photo -- --grouping
```

To label photos by sorted input order:

```sh
pnpm import-photo -- --grouping --roles open,closed,detail
```

Photos in the same import batch are grouped automatically by rounded GPS location. Older records already in `data/photos.json` are not pulled into a new automatic group.

Automatic location grouping uses 5 decimal places by default. You can change that precision:

```sh
pnpm import-photo -- --location-precision 4
```
