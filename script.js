const gallery = document.querySelector("#gallery");
const emptyState = document.querySelector("#empty-state");
const siteTitle = document.querySelector("#site-title");

let photos = [];
let galleryItems = [];
let detailOpen = false;
let currentGroupIndex = 0;
let currentPhotoIndex = 0;
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

function getLongText(photo) {
  return photo.explanation || photo.notes || photo.longDescription || "";
}

function formatDisplayDate(date) {
  const match = String(date).match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return `${match[3]}.${match[2]}.${match[1]}`;
  }

  return date;
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
  renderSiteTitle();
  emptyState.hidden = photos.length > 0;
  galleryItems = buildGalleryItems();

  galleryItems.forEach((item, groupIndex) => {
    const [leadPhoto] = item.photos;
    const card = document.createElement("article");
    card.className = "photo-card";
    card.dataset.groupIndex = String(groupIndex);

    if (detailOpen && groupIndex === currentGroupIndex) {
      card.classList.add("photo-card--expanded");
      renderExpandedCard(card, item);
      gallery.append(card);
      return;
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
  });
}

function renderSiteTitle() {
  siteTitle.textContent = "";

  if (!detailOpen) {
    siteTitle.textContent = "Gates";
    return;
  }

  const link = document.createElement("a");
  link.href = `${location.pathname}${location.search}`;
  link.textContent = "Gates";
  link.setAttribute("aria-label", "Return to all gates");
  link.addEventListener("click", (event) => {
    event.preventDefault();
    closeDetail();
  });

  siteTitle.append(link);
}

function closeDetail() {
  detailOpen = false;
  currentPhotoIndex = 0;
  history.pushState(null, "", `${location.pathname}${location.search}`);
  renderGallery();
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "auto",
  });
}

function renderExpandedCard(card, item) {
  const groupPhotos = item.photos;

  if (currentPhotoIndex >= groupPhotos.length) {
    currentPhotoIndex = 0;
  }

  const photo = groupPhotos[currentPhotoIndex];
  card.id = `photo-${photo.id}`;
  card.setAttribute("aria-live", "polite");

  const media = document.createElement("div");
  media.className = "photo-card__media";

  const imageFrame = document.createElement("div");
  imageFrame.className = "photo-card__image-frame";

  const image = document.createElement("img");
  image.className = "photo-card__full-image";
  image.alt = getPhotoAlt(photo);
  reserveExpandedImageSpace(photo, imageFrame);
  image.addEventListener("load", () =>
    applyLoadedImageRatio(image, imageFrame),
  );
  image.src = getFullPath(photo);

  imageFrame.append(image);
  media.append(imageFrame);

  const notes = document.createElement("aside");
  notes.className = "photo-card__notes";
  notes.append(createPhotoCardControls(), createPhotoCardCopy(item, photo));

  card.append(media, notes);
}

function createPhotoCardControls() {
  const controls = document.createElement("div");
  controls.className = "photo-card__controls";

  const previous = document.createElement("button");
  previous.className = "photo-card__nav";
  previous.type = "button";
  previous.dataset.cardNav = "previous";
  previous.textContent = "Previous";
  previous.setAttribute("aria-label", "Previous gate");
  previous.addEventListener("click", () => showGroup(-1, "previous"));

  const next = document.createElement("button");
  next.className = "photo-card__nav";
  next.type = "button";
  next.dataset.cardNav = "next";
  next.textContent = "Next";
  next.setAttribute("aria-label", "Next gate");
  next.addEventListener("click", () => showGroup(1, "next"));

  controls.append(previous, next);
  return controls;
}

function createPhotoCardCopy(item, photo) {
  const copy = document.createElement("div");

  if (photo.date || photo.location) {
    const meta = document.createElement("div");
    meta.className = "photo-card__meta";

    if (photo.date) {
      const date = document.createElement("p");
      date.className = "photo-card__meta-line";
      const dateLabel = document.createElement("strong");
      dateLabel.textContent = "date: ";
      date.append(dateLabel, formatDisplayDate(photo.date));
      meta.append(date);
    }

    if (photo.location) {
      const location = document.createElement("p");
      location.className = "photo-card__meta-line";
      const locationLabel = document.createElement("strong");
      locationLabel.textContent = "location: ";
      location.append(locationLabel, photo.location);
      meta.append(location);
    }

    copy.append(meta);
  }

  const description = createPhotoCardDescription(photo);
  if (description) {
    copy.append(description);
  }

  if (getLongText(photo)) {
    const explanation = document.createElement("p");
    explanation.className = "photo-card__explanation";
    explanation.textContent = getLongText(photo);
    copy.append(explanation);
  }

  if (item.photos.length > 1) {
    const position = document.createElement("p");
    position.className = "photo-card__position";
    position.textContent = `${currentPhotoIndex + 1} of ${item.photos.length}`;

    const sideGallery = document.createElement("div");
    sideGallery.className = "photo-card__side-gallery";
    sideGallery.append(position, createMiniGallery(item.photos));
    copy.append(sideGallery);
  }

  return copy;
}

function createPhotoCardDescription(photo) {
  if (canEditDescriptions) {
    const textarea = document.createElement("textarea");
    textarea.className = "photo-card__description";
    textarea.value = photo.description || "";
    textarea.rows = 3;

    let lastSavedValue = textarea.value;

    const saveNow = async () => {
      if (textarea.value === lastSavedValue) {
        return;
      }

      await saveDescription(photo, textarea.value);
      lastSavedValue = photo.description || "";
    };

    textarea.addEventListener("blur", saveNow);
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.shiftKey) {
        event.preventDefault();
        saveNow();
      }
    });

    return textarea;
  }

  if (!photo.description) {
    return null;
  }

  const description = document.createElement("p");
  description.className = "photo-card__description";
  description.textContent = photo.description;
  return description;
}

async function saveDescription(photo, description) {
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
    if (detailOpen) {
      renderGallery();
    }
  } catch (error) {
    console.error(error);
  }
}

function openDetail(groupIndex, photoIndex = 0) {
  currentGroupIndex = groupIndex;
  currentPhotoIndex = photoIndex;
  detailOpen = true;
  renderGallery();
  updateDetailHash();
  scrollDetailIntoView();
}

function showGroup(offset, focusAfterUpdate) {
  currentGroupIndex =
    (currentGroupIndex + offset + galleryItems.length) % galleryItems.length;
  currentPhotoIndex = 0;
  renderGallery();
  updateDetailHash();
  scrollDetailIntoView();

  if (focusAfterUpdate) {
    requestAnimationFrame(() => {
      gallery.querySelector(`[data-card-nav="${focusAfterUpdate}"]`)?.focus();
    });
  }
}

function showGroupPhoto(photoIndex) {
  currentPhotoIndex = photoIndex;
  renderGallery();
  updateDetailHash();
  scrollDetailIntoView();
}

function scrollDetailIntoView() {
  const scrollToExpandedCard = () => {
    const expandedCard = gallery.querySelector(".photo-card--expanded");
    if (!expandedCard) {
      return;
    }

    expandedCard.scrollIntoView({
      block: "start",
      inline: "nearest",
      behavior: "auto",
    });
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(scrollToExpandedCard);
    setTimeout(scrollToExpandedCard, 0);
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

function createMiniGallery(groupPhotos) {
  const miniGallery = document.createElement("div");
  miniGallery.className = "mini-gallery";

  groupPhotos.forEach((photo, index) => {
    const button = document.createElement("button");
    button.className = "mini-gallery__photo";
    button.type = "button";
    button.setAttribute(
      "aria-label",
      `Show photo ${index + 1} of ${groupPhotos.length}`,
    );
    button.setAttribute(
      "aria-current",
      index === currentPhotoIndex ? "true" : "false",
    );

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

function reserveExpandedImageSpace(photo, imageFrame) {
  const aspectRatio = Number(
    photo.aspectRatio ||
      (photo.width && photo.height ? photo.width / photo.height : 0),
  );

  if (Number.isFinite(aspectRatio) && aspectRatio > 0) {
    imageFrame.style.aspectRatio = String(aspectRatio);
    imageFrame.style.setProperty("--photo-card-aspect-ratio", aspectRatio);
    return;
  }

  imageFrame.style.aspectRatio = "";
  imageFrame.style.removeProperty("--photo-card-aspect-ratio");
}

function applyLoadedImageRatio(image, imageFrame) {
  if (image.naturalWidth && image.naturalHeight) {
    const aspectRatio = image.naturalWidth / image.naturalHeight;
    imageFrame.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
    imageFrame.style.setProperty("--photo-card-aspect-ratio", aspectRatio);
  }
}

function handleKeydown(event) {
  if (!detailOpen) {
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
    emptyState.textContent =
      "Could not load photos. Serve this folder with a local static server and try again.";
  }
}

document.addEventListener("keydown", handleKeydown);
window.addEventListener("hashchange", openDetailFromHash);

loadPhotos();
