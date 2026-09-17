const form = document.querySelector("#tarot-form");
const nameInput = document.querySelector("#name");
const emailInput = document.querySelector("#email");
const intentionInput = document.querySelector("#intention");
const photoInput = document.querySelector("#photo");
const charCount = document.querySelector("#char-count");
const photoPreview = document.querySelector("#photo-preview");
const uploadTitle = document.querySelector("#upload-title");
const uploadHelp = document.querySelector("#upload-help");
const previewCopy = document.querySelector("#preview-copy");
const loadingState = document.querySelector("#loading-state");
const loadingMessage = document.querySelector("#loading-message");
const resultState = document.querySelector("#result-state");
const canvas = document.querySelector("#tarot-canvas");
const downloadButton = document.querySelector("#download-button");
const restartButton = document.querySelector("#restart-button");

let uploadedImage = null;

intentionInput.addEventListener("input", () => {
  charCount.textContent = intentionInput.value.length;
});

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;

  if (file.size > 8 * 1024 * 1024) {
    photoInput.value = "";
    uploadTitle.textContent = "A foto é muito grande";
    uploadHelp.textContent = "Escolha um arquivo de até 8 MB";
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const image = new Image();
    image.onload = () => { uploadedImage = image; };
    image.src = event.target.result;
    photoPreview.style.backgroundImage = `url("${event.target.result}")`;
    photoPreview.textContent = "";
    uploadTitle.textContent = file.name;
    uploadHelp.textContent = "Foto pronta para a sua carta";
  };
  reader.readAsDataURL(file);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity() || !uploadedImage) return;

  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  previewCopy.hidden = true;
  resultState.hidden = true;
  loadingState.hidden = false;

  const steps = [
    "Lendo a energia da sua intenção",
    "Encontrando o seu arquétipo",
    "Dando forma à sua mensagem"
  ];

  for (const step of steps) {
    loadingMessage.textContent = step;
    await wait(650);
  }

  drawTarotCard();
  loadingState.hidden = true;
  resultState.hidden = false;
  button.disabled = false;
  resultState.scrollIntoView({ behavior: "smooth", block: "center" });
});

downloadButton.addEventListener("click", () => {
  const link = document.createElement("a");
  const safeName = nameInput.value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
  link.download = `carta-${safeName || "de-hoje"}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

restartButton.addEventListener("click", () => {
  resultState.hidden = true;
  previewCopy.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function drawTarotCard() {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const name = nameInput.value.trim();
  const intention = intentionInput.value.trim();
  const archetype = chooseArchetype(intention);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#19102f");
  gradient.addColorStop(.52, "#34225e");
  gradient.addColorStop(1, "#0d1831");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#e3c67a";
  ctx.lineWidth = 4;
  roundedRect(ctx, 26, 26, width - 52, height - 52, 28);
  ctx.stroke();
  ctx.lineWidth = 1;
  roundedRect(ctx, 44, 44, width - 88, height - 88, 22);
  ctx.stroke();

  drawStars(ctx, width, height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e3c67a";
  ctx.font = "500 23px 'DM Sans'";
  ctx.letterSpacing = "4px";
  ctx.fillText("SUA CARTA DE HOJE", width / 2, 102);

  ctx.save();
  ctx.beginPath();
  ctx.arc(width / 2, 370, 205, 0, Math.PI * 2);
  ctx.clip();
  const scale = Math.max(410 / uploadedImage.width, 410 / uploadedImage.height);
  const imageWidth = uploadedImage.width * scale;
  const imageHeight = uploadedImage.height * scale;
  ctx.drawImage(uploadedImage, (width - imageWidth) / 2, 370 - imageHeight / 2, imageWidth, imageHeight);
  const shade = ctx.createLinearGradient(0, 180, 0, 580);
  shade.addColorStop(0, "rgba(18,10,44,.05)");
  shade.addColorStop(1, "rgba(18,10,44,.45)");
  ctx.fillStyle = shade;
  ctx.fillRect(120, 160, 480, 440);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(width / 2, 370, 215, 0, Math.PI * 2);
  ctx.strokeStyle = "#e3c67a";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width / 2, 370, 230, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(227,198,122,.35)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#f8f0db";
  ctx.font = "64px 'Italiana'";
  ctx.fillText(archetype.title, width / 2, 680);
  ctx.fillStyle = "#e3c67a";
  ctx.font = "500 22px 'DM Sans'";
  ctx.fillText(name.toUpperCase(), width / 2, 730);

  ctx.strokeStyle = "rgba(227,198,122,.45)";
  ctx.beginPath();
  ctx.moveTo(200, 772);
  ctx.lineTo(520, 772);
  ctx.stroke();
  ctx.fillStyle = "#e3c67a";
  ctx.font = "28px serif";
  ctx.fillText("✦", width / 2, 782);

  ctx.fillStyle = "#d8cfe8";
  ctx.font = "400 27px 'DM Sans'";
  wrapText(ctx, archetype.message, width / 2, 835, 540, 39);

  ctx.fillStyle = "#a99dbe";
  ctx.font = "italic 22px 'DM Sans'";
  const shortened = intention.length > 115 ? `${intention.slice(0, 112)}…` : intention;
  wrapText(ctx, `“${shortened}”`, width / 2, 1000, 540, 34);

  ctx.fillStyle = "#e3c67a";
  ctx.font = "22px serif";
  ctx.fillText("☾  ✦  ☼  ✦  ☽", width / 2, 1130);
}

function chooseArchetype(text) {
  const normalized = text.toLowerCase();
  const archetypes = [
    { words: ["ouvir", "escutar", "acolher", "entender"], title: "A Escuta", message: "Sua presença abre espaço para que a resposta certa possa aparecer." },
    { words: ["resolver", "solução", "transformar", "melhorar"], title: "A Alquimista", message: "Você transforma desafios em possibilidades e movimento." },
    { words: ["ensinar", "orientar", "explicar", "clareza"], title: "A Lanterna", message: "Sua clareza ilumina o próximo passo de quem caminha com você." },
    { words: ["criar", "imaginar", "inovar", "ideia"], title: "A Criadora", message: "Sua visão dá forma ao que ainda não existia." }
  ];

  return archetypes.find((item) => item.words.some((word) => normalized.includes(word))) || {
    title: "A Presença",
    message: "Sua atenção inteira é o começo de toda transformação verdadeira."
  };
}

function drawStars(ctx, width, height) {
  const stars = [[84,158,4],[624,184,3],[82,524,3],[640,600,4],[110,830,3],[608,914,3],[100,1080,4],[620,1060,3],[574,124,2],[150,690,2]];
  ctx.fillStyle = "rgba(227,198,122,.75)";
  stars.forEach(([x, y, size]) => {
    ctx.beginPath();
    ctx.moveTo(x, y - size * 2);
    ctx.lineTo(x + size, y - size / 2);
    ctx.lineTo(x + size * 2, y);
    ctx.lineTo(x + size, y + size / 2);
    ctx.lineTo(x, y + size * 2);
    ctx.lineTo(x - size, y + size / 2);
    ctx.lineTo(x - size * 2, y);
    ctx.lineTo(x - size, y - size / 2);
    ctx.closePath();
    ctx.fill();
  });
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  lines.push(line);
  lines.forEach((current, index) => ctx.fillText(current, x, y + index * lineHeight));
}
