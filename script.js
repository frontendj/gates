const gallery = document.querySelector("#gallery");
const emptyState = document.querySelector("#empty-state");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxCaption = document.querySelector("#lightbox-caption");
const closeLightboxButton = document.querySelector("#close-lightbox");
const previousPhotoButton = document.querySelector("#previous-photo");
const nextPhotoButton = document.querySelector("#next-photo");

let photos = [];
let lightboxPhotos = [];
let currentIndex = 0;
const canEditDescriptions = ["localhost", "127.0.0.1", "::1"].includes(
  location.hostname,
);

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
  return [photo.groupRole, photo.location, photo.date].filter(Boolean).join(" - ");
}

function buildGalleryItems() {
  const groupedItems = new Map();
  const items = [];

  photos.forEach((photo) => {
    if (!photo.groupId) {
      items.push({
        type: "photo",
        photos: [photo],
      });
      return;
    }

    if (!groupedItems.has(photo.groupId)) {
      const item = {
        type: "group",
        groupId: photo.groupId,
        photos: [],
      };
      groupedItems.set(photo.groupId, item);
      items.push(item);
    }

    groupedItems.get(photo.groupId).photos.push(photo);
  });

  return items;
}

function renderGallery() {
  gallery.innerHTML = "";
  emptyState.hidden = photos.length > 0;

  buildGalleryItems().forEach((item) => {
    const [leadPhoto] = item.photos;
    const card = document.createElement("article");
    card.className = "photo-card";

    const imageButton = document.createElement("button");
    imageButton.className = "photo-card__image-button";
    imageButton.type = "button";
    imageButton.setAttribute("aria-label", `Open ${getPhotoAlt(leadPhoto)}`);

    const image = document.createElement("img");
    image.className = "photo-card__image";
    image.src = getPreviewPath(leadPhoto);
    image.alt = getPhotoAlt(leadPhoto);
    image.loading = "lazy";
    imageButton.append(image);

    if (item.photos.length > 1) {
      const count = document.createElement("span");
      count.className = "photo-card__count";
      count.textContent = `+${item.photos.length - 1}`;
      imageButton.append(count);
    }

    const body = document.createElement("div");
    body.className = "photo-card__body";

    const metaText = getMetaText(leadPhoto);
    if (metaText) {
      const meta = document.createElement("div");
      meta.className = "photo-card__meta";
      meta.textContent = metaText;
      body.append(meta);
    }

    if (leadPhoto.description) {
      const description = document.createElement("p");
      description.className = "photo-card__description";
      description.textContent = leadPhoto.description;
      body.append(description);
    }

    if (canEditDescriptions) {
      body.append(createDescriptionEditor(leadPhoto));
    }

    card.append(imageButton, body);
    imageButton.addEventListener("click", () => openLightbox(item.photos));
    gallery.append(card);
  });
}

function createDescriptionEditor(photo) {
  const form = document.createElement("form");
  form.className = "description-editor";

  const label = document.createElement("label");
  label.className = "description-editor__label";
  label.textContent = `Description for photo ${photo.id}`;

  const textarea = document.createElement("textarea");
  textarea.className = "description-editor__textarea";
  textarea.value = photo.description || "";
  textarea.rows = 3;

  const actions = document.createElement("div");
  actions.className = "description-editor__actions";

  const status = document.createElement("span");
  status.className = "description-editor__status";
  status.setAttribute("aria-live", "polite");

  const saveButton = document.createElement("button");
  saveButton.className = "description-editor__save";
  saveButton.type = "submit";
  saveButton.textContent = "Save";

  actions.append(status, saveButton);
  label.append(textarea);
  form.append(label, actions);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveDescription(photo, textarea.value, status, saveButton);
  });

  return form;
}

async function saveDescription(photo, description, status, saveButton) {
  saveButton.disabled = true;
  status.textContent = "Saving...";

  try {
    const response = await fetch(`api/photos/${photo.id}/description`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      throw new Error(`Could not save description: ${response.status}`);
    }

    const data = await response.json();
    photo.description = data.photo.description;
    status.textContent = "Saved";
    renderGallery();

    if (!lightbox.hidden) {
      updateLightbox();
    }
  } catch (error) {
    console.error(error);
    status.textContent = "Could not save";
  } finally {
    saveButton.disabled = false;
  }
}

function openLightbox(selectedPhotos, index = 0) {
  lightboxPhotos = selectedPhotos;
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
  currentIndex = (currentIndex + offset + lightboxPhotos.length) % lightboxPhotos.length;
  updateLightbox();
}

function updateLightbox() {
  const photo = lightboxPhotos[currentIndex];
  lightboxImage.src = getFullPath(photo);
  lightboxImage.alt = getPhotoAlt(photo);

  const metaText = getMetaText(photo);
  lightboxCaption.innerHTML = "";

  const text = [metaText, photo.description].filter(Boolean).join(" - ");
  if (text) {
    const captionText = document.createElement("p");
    captionText.className = "lightbox__caption-text";
    captionText.textContent = text;
    lightboxCaption.append(captionText);
  }

  if (lightboxPhotos.length > 1) {
    const position = document.createElement("p");
    position.className = "lightbox__position";
    position.textContent = `${currentIndex + 1} of ${lightboxPhotos.length}`;
    lightboxCaption.append(position);
  }

  if (canEditDescriptions) {
    lightboxCaption.append(createDescriptionEditor(photo));
  }
}

function handleKeydown(event) {
  if (lightbox.hidden) {
    return;
  }

  if (["INPUT", "TEXTAREA"].includes(event.target.tagName)) {
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
