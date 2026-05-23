const gallery = document.querySelector("#gallery");
const emptyState = document.querySelector("#empty-state");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxCaption = document.querySelector("#lightbox-caption");
const closeLightboxButton = document.querySelector("#close-lightbox");
const previousPhotoButton = document.querySelector("#previous-photo");
const nextPhotoButton = document.querySelector("#next-photo");

let photos = [];
let currentIndex = 0;

function getPreviewPath(photo) {
  return `photos/${photo.id}-sm.jpg`;
}

function getFullPath(photo) {
  return `photos/${photo.id}.jpg`;
}

function getPhotoAlt(photo) {
  return photo.description || photo.location || `Gate photo ${photo.id}`;
}

function getMetaText(photo) {
  return [photo.location, photo.date].filter(Boolean).join(" - ");
}

function renderGallery() {
  gallery.innerHTML = "";
  emptyState.hidden = photos.length > 0;

  photos.forEach((photo, index) => {
    const card = document.createElement("button");
    card.className = "photo-card";
    card.type = "button";
    card.setAttribute("aria-label", `Open ${getPhotoAlt(photo)}`);

    const image = document.createElement("img");
    image.className = "photo-card__image";
    image.src = getPreviewPath(photo);
    image.alt = getPhotoAlt(photo);
    image.loading = "lazy";

    const body = document.createElement("div");
    body.className = "photo-card__body";

    const metaText = getMetaText(photo);
    if (metaText) {
      const meta = document.createElement("div");
      meta.className = "photo-card__meta";
      meta.textContent = metaText;
      body.append(meta);
    }

    if (photo.description) {
      const description = document.createElement("p");
      description.className = "photo-card__description";
      description.textContent = photo.description;
      body.append(description);
    }

    card.append(image, body);
    card.addEventListener("click", () => openLightbox(index));
    gallery.append(card);
  });
}

function openLightbox(index) {
  currentIndex = index;
  updateLightbox();
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
  closeLightboxButton.focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = "";
}

function showPhoto(offset) {
  currentIndex = (currentIndex + offset + photos.length) % photos.length;
  updateLightbox();
}

function updateLightbox() {
  const photo = photos[currentIndex];
  lightboxImage.src = getFullPath(photo);
  lightboxImage.alt = getPhotoAlt(photo);

  const metaText = getMetaText(photo);
  lightboxCaption.textContent = [metaText, photo.description].filter(Boolean).join(" - ");
}

function handleKeydown(event) {
  if (lightbox.hidden) {
    return;
  }

  if (event.key === "Escape") {
    closeLightbox();
  }

  if (event.key === "ArrowLeft") {
    showPhoto(-1);
  }

  if (event.key === "ArrowRight") {
    showPhoto(1);
  }
}

async function loadPhotos() {
  try {
    const response = await fetch("data/photos.json");

    if (!response.ok) {
      throw new Error(`Could not load photo data: ${response.status}`);
    }

    photos = await response.json();
    renderGallery();
  } catch (error) {
    console.error(error);
    emptyState.hidden = false;
    emptyState.textContent = "Could not load photos. Serve this folder with a local static server and try again.";
  }
}

closeLightboxButton.addEventListener("click", closeLightbox);
previousPhotoButton.addEventListener("click", () => showPhoto(-1));
nextPhotoButton.addEventListener("click", () => showPhoto(1));
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});
document.addEventListener("keydown", handleKeydown);

loadPhotos();
