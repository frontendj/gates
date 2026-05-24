const gallery = document.querySelector("#gallery");
const emptyState = document.querySelector("#empty-state");
const detail = document.querySelector("#detail");
const detailImageFrame = document.querySelector("#detail-image-frame");
const detailImage = document.querySelector("#detail-image");
const detailMiniGallery = document.querySelector("#detail-mini-gallery");
const detailCopy = document.querySelector("#detail-copy");
const previousGroupButton = document.querySelector("#previous-group");
const nextGroupButton = document.querySelector("#next-group");

let photos = [];
let galleryItems = [];
let detailPhotos = [];
let currentGroupIndex = 0;
let currentPhotoIndex = 0;
const descriptionSaveDelay = 3000;
const mode = new URLSearchParams(location.search).get("mode");
const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(
  location.hostname,
);
const canEditDescriptions = isLocalhost && mode !== "view";

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

function getLongText(photo) {
  return photo.explanation || photo.notes || photo.longDescription || "";
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
  galleryItems = buildGalleryItems();

  galleryItems.forEach((item, groupIndex) => {
    const [leadPhoto] = item.photos;
    const card = document.createElement("article");
    card.className = "photo-card";
    card.dataset.groupIndex = String(groupIndex);

    if (!detail.hidden && groupIndex === currentGroupIndex) {
      card.classList.add("photo-card--active");
    }

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

    card.append(imageButton);
    imageButton.addEventListener("click", () => openDetail(groupIndex));
    gallery.append(card);

    if (!detail.hidden && groupIndex === currentGroupIndex) {
      gallery.append(detail);
    }
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

  const status = document.createElement("span");
  status.className = "description-editor__status";
  status.setAttribute("aria-live", "polite");

  let saveTimeout;
  let lastSavedValue = textarea.value;

  label.append(textarea);
  form.append(label, status);

  const queueSave = () => {
    clearTimeout(saveTimeout);
    status.textContent = "Unsaved changes";
    saveTimeout = setTimeout(() => {
      saveNow();
    }, descriptionSaveDelay);
  };

  const saveNow = async () => {
    clearTimeout(saveTimeout);

    if (textarea.value === lastSavedValue) {
      status.textContent = "";
      return;
    }

    await saveDescription(photo, textarea.value, status);
    lastSavedValue = photo.description || "";
  };

  textarea.addEventListener("input", queueSave);
  textarea.addEventListener("blur", saveNow);
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      saveNow();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveNow();
  });

  return form;
}

async function saveDescription(photo, description, status) {
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

    if (!detail.hidden) {
      updateDetail();
    }
  } catch (error) {
    console.error(error);
    status.textContent = "Could not save";
  }
}

function openDetail(groupIndex, photoIndex = 0) {
  currentGroupIndex = groupIndex;
  currentPhotoIndex = photoIndex;
  detail.hidden = false;
  updateDetail();
  placeDetailAfterActiveCard();
  updateDetailHash();
  scrollDetailIntoView();
}

function showGroup(offset, focusAfterUpdate) {
  currentGroupIndex = (currentGroupIndex + offset + galleryItems.length) % galleryItems.length;
  currentPhotoIndex = 0;
  updateDetail();
  setActiveCard();
  placeDetailAfterActiveCard();
  updateDetailHash();
  scrollDetailIntoView();

  if (focusAfterUpdate) {
    requestAnimationFrame(() => {
      focusAfterUpdate.focus();
    });
  }
}

function showGroupPhoto(photoIndex) {
  currentPhotoIndex = photoIndex;
  updateDetail();
  updateDetailHash();
}

function updateDetail() {
  const currentGroup = galleryItems[currentGroupIndex];

  if (!currentGroup) {
    detail.hidden = true;
    return;
  }

  detailPhotos = currentGroup.photos;

  if (currentPhotoIndex >= detailPhotos.length) {
    currentPhotoIndex = 0;
  }

  const photo = detailPhotos[currentPhotoIndex];
  reserveDetailImageSpace(photo);
  detailImage.src = getFullPath(photo);
  detailImage.alt = getPhotoAlt(photo);

  const metaText = getMetaText(photo);
  detailCopy.innerHTML = "";
  detailMiniGallery.innerHTML = "";

  const heading = document.createElement("p");
  heading.className = "detail__eyebrow";
  heading.textContent = currentGroup.photos.length > 1 ? "Linked gate study" : "Gate study";
  detailCopy.append(heading);

  if (metaText) {
    const meta = document.createElement("p");
    meta.className = "detail__meta";
    meta.textContent = metaText;
    detailCopy.append(meta);
  }

  if (photo.description) {
    const description = document.createElement("p");
    description.className = "detail__description";
    description.textContent = photo.description;
    detailCopy.append(description);
  }

  if (getLongText(photo)) {
    const explanation = document.createElement("p");
    explanation.className = "detail__explanation";
    explanation.textContent = getLongText(photo);
    detailCopy.append(explanation);
  }

  if (detailPhotos.length > 1) {
    const position = document.createElement("p");
    position.className = "detail__position";
    position.textContent = `${currentPhotoIndex + 1} of ${detailPhotos.length}`;

    const sideGallery = document.createElement("div");
    sideGallery.className = "detail__side-gallery";
    sideGallery.append(position);
    sideGallery.append(createMiniGallery(detailPhotos));
    detailCopy.append(sideGallery);
  }

  if (canEditDescriptions) {
    detailCopy.append(createDescriptionEditor(photo));
  }
}

function placeDetailAfterActiveCard() {
  const activeCard = gallery.querySelector(`[data-group-index="${currentGroupIndex}"]`);

  if (activeCard) {
    activeCard.after(detail);
  }
}

function scrollDetailIntoView() {
  requestAnimationFrame(() => {
    const top = detail.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top,
      left: 0,
      behavior: "auto",
    });
  });
}

function updateDetailHash() {
  const photo = galleryItems[currentGroupIndex]?.photos[currentPhotoIndex];

  if (!photo) {
    return;
  }

  const hash = `#photo-${photo.id}`;

  if (location.hash !== hash) {
    history.pushState(null, "", hash);
  }
}

function openDetailFromHash() {
  const match = location.hash.match(/^#photo-(\d+)$/);

  if (!match || galleryItems.length === 0) {
    return;
  }

  const photoId = Number(match[1]);

  for (const [groupIndex, item] of galleryItems.entries()) {
    const photoIndex = item.photos.findIndex((photo) => photo.id === photoId);

    if (photoIndex !== -1) {
      openDetail(groupIndex, photoIndex);
      return;
    }
  }
}

function setActiveCard() {
  gallery.querySelectorAll(".photo-card--active").forEach((card) => {
    card.classList.remove("photo-card--active");
  });

  const activeCard = gallery.querySelector(`[data-group-index="${currentGroupIndex}"]`);
  activeCard?.classList.add("photo-card--active");
}

function createMiniGallery(groupPhotos) {
  const miniGallery = document.createElement("div");
  miniGallery.className = "mini-gallery";

  groupPhotos.forEach((photo, index) => {
    const button = document.createElement("button");
    button.className = "mini-gallery__photo";
    button.type = "button";
    button.setAttribute("aria-label", `Show photo ${index + 1} of ${groupPhotos.length}`);
    button.setAttribute("aria-current", index === currentPhotoIndex ? "true" : "false");

    const image = document.createElement("img");
    image.src = getPreviewPath(photo);
    image.alt = "";
    image.loading = "lazy";

    button.append(image);
    button.addEventListener("click", () => showGroupPhoto(index));
    miniGallery.append(button);
  });

  return miniGallery;
}

function reserveDetailImageSpace(photo) {
  const aspectRatio = Number(photo.aspectRatio || (photo.width && photo.height ? photo.width / photo.height : 0));

  if (Number.isFinite(aspectRatio) && aspectRatio > 0) {
    detailImageFrame.style.aspectRatio = String(aspectRatio);
    detailImageFrame.style.setProperty("--detail-aspect-ratio", aspectRatio);
    return;
  }

  detailImageFrame.style.aspectRatio = "";
  detailImageFrame.style.removeProperty("--detail-aspect-ratio");
}

detailImage.addEventListener("load", () => {
  if (detailImage.naturalWidth && detailImage.naturalHeight) {
    const aspectRatio = detailImage.naturalWidth / detailImage.naturalHeight;
    detailImageFrame.style.aspectRatio = `${detailImage.naturalWidth} / ${detailImage.naturalHeight}`;
    detailImageFrame.style.setProperty("--detail-aspect-ratio", aspectRatio);
  }
});

function handleKeydown(event) {
  if (detail.hidden) {
    return;
  }

  if (["INPUT", "TEXTAREA"].includes(event.target.tagName)) {
    return;
  }

  if (event.key === "ArrowLeft") {
    showGroup(-1);
  }

  if (event.key === "ArrowRight") {
    showGroup(1);
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
    openDetailFromHash();
  } catch (error) {
    console.error(error);
    emptyState.hidden = false;
    emptyState.textContent = "Could not load photos. Serve this folder with a local static server and try again.";
  }
}

previousGroupButton.addEventListener("click", () => showGroup(-1, previousGroupButton));
nextGroupButton.addEventListener("click", () => showGroup(1, nextGroupButton));
document.addEventListener("keydown", handleKeydown);
window.addEventListener("hashchange", openDetailFromHash);

loadPhotos();
