# Gates

A small static gallery for photos of gates that allow some kinds of passage while blocking others.

## Run The Website

```sh
pnpm serve
```

Then open `http://localhost:8000`.

If port `8000` is busy, the server will automatically try the next available port and print the URL.

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