const photoInput = document.getElementById("photoInput");
const sourcePreview = document.getElementById("sourcePreview");
const sourcePanelImage = document.getElementById("sourcePanelImage");
const generateButton = document.getElementById("generateButton");
const resetButton = document.getElementById("resetButton");
const statusText = document.getElementById("statusText");
const resultImage = document.getElementById("resultImage");
const previewPlaceholder = document.getElementById("previewPlaceholder");
const downloadLink = document.getElementById("downloadLink");
const templateSelect = document.getElementById("templateSelect");
const patchToneSelect = document.getElementById("patchToneSelect");
const moodSelect = document.getElementById("moodSelect");
const nameInput = document.getElementById("nameInput");
const charmInput = document.getElementById("charmInput");
const cropInput = document.getElementById("cropInput");
const furInput = document.getElementById("furInput");
const patchScaleInput = document.getElementById("patchScaleInput");
const sizeSelect = document.getElementById("sizeSelect");
const furValue = document.getElementById("furValue");
const patchScaleValue = document.getElementById("patchScaleValue");
const healthBadge = document.getElementById("healthBadge");
const sourceMeta = document.getElementById("sourceMeta");
const resultMeta = document.getElementById("resultMeta");
const resultLabel = document.getElementById("resultLabel");
const summaryList = document.getElementById("summaryList");

let sourceDataUrl = "";

const patchToneLabels = {
  mint: "Mint Stitch",
  peach: "Peach Stitch",
  pink: "Bubble Pink",
  cocoa: "Cocoa Felt",
};

const moodLabels = {
  "mint-bloom": "Mint Bloom",
  "butter-cream": "Butter Cream",
  "sky-sorbet": "Sky Sorbet",
  "pearl-lilac": "Pearl Lilac",
};

function sanitizeName(value) {
  const filtered = value.replace(/[^a-z]/gi, "").slice(0, 10);
  if (!filtered) {
    return "Bam";
  }

  return filtered.charAt(0).toUpperCase() + filtered.slice(1).toLowerCase();
}

function updateSliderLabel() {
  furValue.textContent = furInput.value;
  patchScaleValue.textContent = patchScaleInput.value;
}

function updateSummary() {
  const safeName = sanitizeName(nameInput.value);
  nameInput.value = safeName;

  const items = [
    "Heart Fur + Name Patch",
    patchToneLabels[patchToneSelect.value],
    moodLabels[moodSelect.value],
    `Patch: ${safeName}`,
  ];

  summaryList.innerHTML = items.map((item) => `<li>${item}</li>`).join("");
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? "#9d3d32" : "";
}

function setSourcePreview(dataUrl, fileName = "업로드됨") {
  sourceDataUrl = dataUrl;
  sourcePreview.src = dataUrl;
  sourcePreview.style.display = "block";
  sourcePanelImage.src = dataUrl;
  sourcePanelImage.style.display = "block";
  previewPlaceholder.style.display = "none";
  sourceMeta.textContent = fileName;
  resultMeta.textContent = "원본 확인 중";
  resultLabel.textContent = "Source ready";
}

function clearResult() {
  resultImage.removeAttribute("src");
  resultImage.style.display = "none";
  resultMeta.textContent = sourceDataUrl ? "생성 전" : "업로드 대기 중";
  resultLabel.textContent = "Not generated";
  downloadLink.classList.add("is-disabled");
  downloadLink.href = "#";
}

function resetAll() {
  photoInput.value = "";
  sourceDataUrl = "";
  sourcePreview.removeAttribute("src");
  sourcePreview.style.display = "none";
  sourcePanelImage.removeAttribute("src");
  sourcePanelImage.style.display = "none";
  resultImage.removeAttribute("src");
  resultImage.style.display = "none";
  previewPlaceholder.style.display = "grid";
  sourceMeta.textContent = "대기 중";
  clearResult();
  nameInput.value = "Bam";
  patchToneSelect.value = "mint";
  moodSelect.value = "mint-bloom";
  charmInput.checked = true;
  cropInput.checked = true;
  furInput.value = "72";
  patchScaleInput.value = "56";
  sizeSelect.value = "1024x1024";
  updateSliderLabel();
  updateSummary();
  setStatus("사진을 올리고 이름 패치를 입력하면 바로 생성할 수 있어요.");
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("사진을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

async function loadHealth() {
  try {
    const response = await fetch("/api/openai/health", { cache: "no-store" });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "OpenAI 연결을 확인하지 못했습니다.");
    }

    healthBadge.textContent = result.configured ? "API 키 연결됨" : "API 키 필요";
    healthBadge.className = result.configured ? "health-badge is-ok" : "health-badge is-error";
  } catch (error) {
    healthBadge.textContent = "연결 안 됨";
    healthBadge.className = "health-badge is-error";
  }
}

function buildPrompt() {
  const safeName = sanitizeName(nameInput.value);
  const patchTone = patchToneLabels[patchToneSelect.value];
  const mood = moodLabels[moodSelect.value];
  const furLevel = Number(furInput.value);
  const patchScale = Number(patchScaleInput.value);

  return [
    "Create a premium e-commerce product image for a custom pet keyring charm.",
    "Use the uploaded pet photo as the core reference for the pet identity and facial features.",
    "Main object must be a heart-shaped fluffy faux fur keyring, centered, front-facing, adorable, tactile, and highly polished.",
    `The heart should feel ${furLevel >= 70 ? "very plush and dense" : "soft and neatly groomed"} with realistic fur strands.`,
    `Add a sewn embroidered name patch across the center that reads '${safeName}'.`,
    `The patch should feel like ${patchTone}, raised, fluffy, stitched, and physically attached to the heart.`,
    patchScale >= 60
      ? "Make the name patch slightly larger and more prominent."
      : "Keep the name patch balanced and compact.",
    charmInput.checked
      ? "Include a small circular photo charm featuring the uploaded pet photo near the top-left of the heart."
      : "Do not include a separate photo charm.",
    cropInput.checked
      ? "Auto-crop and isolate the pet cleanly from the original photo."
      : "Preserve more of the original photo framing when referencing the pet.",
    `Background mood should be ${mood}, clean, soft-gradient, minimal, and product-focused.`,
    "Avoid extra props, avoid multiple products, avoid clutter, avoid any text other than the name patch.",
  ].join(" ");
}

async function generateKeyring() {
  if (!sourceDataUrl) {
    setStatus("먼저 반려동물 사진을 올려 주세요.", true);
    return;
  }

  const safeName = sanitizeName(nameInput.value);
  nameInput.value = safeName;
  updateSummary();

  generateButton.disabled = true;
  generateButton.textContent = "생성 중...";
  resultMeta.textContent = "OpenAI 생성 중";
  resultLabel.textContent = "Generating";
  setStatus("키링 이미지를 만들고 있어요. 첫 생성은 조금 더 걸릴 수 있어요.");

  try {
    const payload = {
      name: safeName,
      template: templateSelect.value,
      photoDataUrl: sourceDataUrl,
      prompt: buildPrompt(),
      outputSize: sizeSelect.value,
      options: {
        patchTone: patchToneSelect.value,
        mood: moodSelect.value,
        includeCharm: charmInput.checked,
        autoCrop: cropInput.checked,
        furVolume: Number(furInput.value),
        patchScale: Number(patchScaleInput.value),
      },
    };

    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "키링 이미지 생성에 실패했습니다.");
    }

    resultImage.src = result.imageDataUrl;
    resultImage.style.display = "block";
    resultMeta.textContent = `${result.model} · ${result.size}`;
    resultLabel.textContent = safeName;
    downloadLink.href = result.imageDataUrl;
    downloadLink.classList.remove("is-disabled");
    setStatus("생성이 완료됐어요. 결과가 마음에 들면 PNG로 저장할 수 있어요.");
  } catch (error) {
    clearResult();
    setStatus(error.message || "키링 이미지 생성에 실패했습니다.", true);
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = "키링 이미지 만들기";
  }
}

photoInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    setSourcePreview(dataUrl, file.name);
    clearResult();
    setStatus("사진이 준비됐어요. 이름 패치와 무드를 조정한 뒤 생성해 보세요.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

[nameInput, patchToneSelect, moodSelect, templateSelect].forEach((element) => {
  element.addEventListener("input", updateSummary);
  element.addEventListener("change", updateSummary);
});

furInput.addEventListener("input", updateSliderLabel);
patchScaleInput.addEventListener("input", updateSliderLabel);
generateButton.addEventListener("click", generateKeyring);
resetButton.addEventListener("click", resetAll);

updateSliderLabel();
updateSummary();
clearResult();
loadHealth();
