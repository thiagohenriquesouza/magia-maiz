"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ACCEPTED_IMAGE_TYPES, BUSINESS_UNITS, MAX_INTENTION_LENGTH, MAX_PHOTO_BYTES, NORMALIZED_PHOTO_QUALITY, NORMALIZED_PHOTO_SIZE, type Locale } from "@/lib/config";
import { getCopy } from "@/lib/i18n";

type GenerationState = "idle" | "validating" | "uploading" | "generating" | "storing" | "ready" | "error";
type CropState = { source: string; image: HTMLImageElement; zoom: number; x: number; y: number };
type DragState = { pointerId: number; startX: number; startY: number; originX: number; originY: number; canvasScale: number };

export function Experience({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [state, setState] = useState<GenerationState>("idle");
  const [intention, setIntention] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [crop, setCrop] = useState<CropState | null>(null);
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [resultUrl, setResultUrl] = useState("");
  const [shareHint, setShareHint] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [imageError, setImageError] = useState("");
  const [formDataSnapshot, setFormDataSnapshot] = useState<FormData | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const termsRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    fetch("/api/events/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
      keepalive: true
    }).catch(() => undefined);
  }, [locale]);

  useEffect(() => {
    if (!crop) return;
    drawCropPreview();
  }, [crop]);

  useEffect(() => {
    if (!["uploading", "generating", "storing"].includes(state)) return;
    const messageTimer = window.setInterval(() => setMessageIndex((current) => (current + 1) % t.loading.length), 5000);
    const progressTimer = window.setInterval(() => {
      setProgress((current) => {
        if (state === "uploading") return Math.min(current + 2.5, 28);
        if (state === "generating") return Math.min(current + Math.max(.25, (92 - current) * .025), 92);
        return Math.min(current + 1.8, 97);
      });
    }, 280);
    return () => {
      window.clearInterval(messageTimer);
      window.clearInterval(progressTimer);
    };
  }, [state, t.loading.length]);

  async function onPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setImageError("");
    if (!file || !isAcceptedPhoto(file) || file.size > MAX_PHOTO_BYTES) {
      setImageError(t.invalidImage);
      return;
    }

    let displayBlob: Blob = file;
    try {
      if (isHeic(file)) {
        const { default: heic2any } = await import("heic2any");
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: NORMALIZED_PHOTO_QUALITY });
        displayBlob = Array.isArray(converted) ? converted[0] : converted;
      }
    } catch {
      setImageError(t.invalidImage);
      return;
    }

    const source = URL.createObjectURL(displayBlob);
    const image = new Image();
    image.onload = () => {
      setCrop({ source, image, zoom: 1, x: 0, y: 0 });
      requestAnimationFrame(drawCropPreview);
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      setImageError(t.invalidImage);
    };
    image.src = source;
  }

  function drawCropPreview() {
    const canvas = canvasRef.current;
    if (!canvas || !crop) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    drawCrop(ctx, crop, size, 1);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!crop) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    setDrag({ pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: crop.x, originY: crop.y, canvasScale: event.currentTarget.width / rect.width });
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!crop || !drag || drag.pointerId !== event.pointerId) return;
    setCrop({ ...crop, x: drag.originX + (event.clientX - drag.startX) * drag.canvasScale, y: drag.originY + (event.clientY - drag.startY) * drag.canvasScale });
  }

  function onPointerUp() {
    setDrag(null);
  }

  function confirmCrop() {
    const canvas = canvasRef.current;
    if (!canvas || !crop) return;
    const outputSize = Math.max(1, Math.min(NORMALIZED_PHOTO_SIZE, Math.floor(Math.min(crop.image.naturalWidth, crop.image.naturalHeight))));
    const output = document.createElement("canvas");
    output.width = outputSize;
    output.height = outputSize;
    const context = output.getContext("2d");
    if (!context) return;
    drawCrop(context, crop, outputSize, outputSize / canvas.width);
    output.toBlob((blob) => {
      if (!blob) return;
      if (blob.size > MAX_PHOTO_BYTES) {
        setImageError(t.invalidImage);
        return;
      }
      const nextPhoto = new File([blob], "portrait.jpg", { type: "image/jpeg" });
      setPhoto(nextPhoto);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(URL.createObjectURL(blob));
      URL.revokeObjectURL(crop.source);
      setCrop(null);
    }, "image/jpeg", NORMALIZED_PHOTO_QUALITY);
  }

  function cancelCrop() {
    if (crop) URL.revokeObjectURL(crop.source);
    setCrop(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo) {
      setImageError(t.invalidImage);
      return;
    }
    const data = new FormData(event.currentTarget);
    data.set("photo", photo);
    data.set("locale", locale);
    data.set("consent", "true");
    setFormDataSnapshot(data);
    await generate(data);
  }

  async function generate(data: FormData) {
    setState("validating");
    setProgress(4);
    setMessageIndex(0);
    setShareHint("");
    setAttempts((value) => value + 1);

    try {
      setState("uploading");
      await wait(350);
      setState("generating");
      const response = await fetch("/api/generate", { method: "POST", body: data });
      if (!response.ok) throw new Error("generation_failed");
      setState("storing");
      const payload = (await response.json()) as { url: string };
      setProgress(100);
      await wait(450);
      setResultUrl(payload.url);
      setState("ready");
      window.setTimeout(() => triggerDownload(payload.url), 300);
    } catch {
      setState("error");
    }
  }

  async function triggerDownload(url = resultUrl) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = localUrl;
      link.download = "minha-carta.webp";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(localUrl), 2000);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  async function shareResult() {
    try {
      const response = await fetch(resultUrl);
      const blob = await response.blob();
      const file = new File([blob], "minha-carta.webp", { type: "image/webp" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: t.shareText });
      } else {
        setShareHint(t.shareFallback);
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setShareHint(t.shareFallback);
    }
  }

  function restart() {
    setState("idle");
    setResultUrl("");
    setProgress(0);
    setShareHint("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const isBusy = ["validating", "uploading", "generating", "storing"].includes(state);

  return (
    <main className="page-shell">
      <div className="sky" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <header className="topbar">
        <a className="brand" href={locale === "pt" ? "/" : "/es"}><span>✦</span> Magia</a>
        <a className="language-switch" href={t.switchHref} lang={locale === "pt" ? "es" : "pt-BR"}>{t.switchLabel}</a>
      </header>

      <section className="intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
      </section>

      <section className="experience" aria-label={t.title}>
        <form ref={formRef} className="form-card" onSubmit={onSubmit}>
          <div className="field-row">
            <label className="field">
              <span>{t.name}</span>
              <input name="name" maxLength={80} autoComplete="name" placeholder={t.namePlaceholder} required disabled={isBusy} />
            </label>
            <label className="field">
              <span>{t.unit}</span>
              <select name="businessUnit" defaultValue="" required disabled={isBusy}>
                <option value="" disabled>{t.unitPlaceholder}</option>
                {BUSINESS_UNITS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
              </select>
            </label>
          </div>

          <div className="photo-field">
            <span className="field-label">{t.photo}</span>
            {photoPreview ? (
              <div className="photo-ready">
                <img src={photoPreview} alt="" />
                <div><strong>{t.photoReady}</strong><small>{t.photoHelp}</small></div>
                <label className="small-action">{t.cropCancel}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={onPhotoSelected} disabled={isBusy} /></label>
              </div>
            ) : (
              <div className="photo-actions">
                <label className="photo-action"><span aria-hidden="true">▧</span>{t.choosePhoto}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={onPhotoSelected} disabled={isBusy} /></label>
                <label className="photo-action"><span aria-hidden="true">◉</span>{t.takePhoto}<input type="file" accept="image/*" capture="user" onChange={onPhotoSelected} disabled={isBusy} /></label>
              </div>
            )}
            {imageError && <p className="field-error" role="alert">{imageError}</p>}
          </div>

          <label className="field intention-field">
            <span>{t.intention}</span>
            <textarea name="intention" rows={4} maxLength={MAX_INTENTION_LENGTH} value={intention} onChange={(event) => setIntention(event.target.value)} placeholder={t.intentionPlaceholder} required disabled={isBusy} />
            <small>{intention.length}/{MAX_INTENTION_LENGTH}</small>
          </label>

          <label className="consent">
            <input name="terms" type="checkbox" required disabled={isBusy} />
            <span>{t.consentStart}<button type="button" onClick={() => termsRef.current?.showModal()}>{t.terms}</button>{t.consentEnd}</span>
          </label>

          <button className="primary-button" type="submit" disabled={isBusy}>
            <span>{t.reveal}</span><span aria-hidden="true">✦</span>
          </button>
          <p className="privacy">{t.privacy}</p>
        </form>

        <aside className="preview-panel" aria-live="polite">
          {state === "idle" && <div className="preview-copy"><span className="moon" aria-hidden="true">☾</span><p>{t.preview}</p></div>}
          {isBusy && (
            <div className="loading-state">
              <div className="orbital-loader" aria-hidden="true"><span>✦</span></div>
              <h2>{t.processing}</h2>
              <p className="loading-message">{t.loading[messageIndex]}</p>
              <div className="progress-track" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <strong className="progress-number">{Math.round(progress)}%</strong>
              <p className="keep-open">{t.keepOpen}</p>
            </div>
          )}
          {state === "error" && (
            <div className="error-state">
              <span aria-hidden="true">☾</span>
              <h2>{t.errorTitle}</h2>
              <button className="primary-button" type="button" onClick={() => formDataSnapshot && generate(formDataSnapshot)}>{t.retry}</button>
              {attempts > 1 && <p>{t.troubleshooting}</p>}
            </div>
          )}
          {state === "ready" && (
            <div className="result-state">
              <p className="eyebrow">{t.resultKicker}</p>
              <img src={resultUrl} alt={t.resultKicker} />
              <p className="download-note">{t.downloaded}</p>
              <div className="result-actions">
                <button className="primary-button" type="button" onClick={() => triggerDownload()}>{t.download}<span aria-hidden="true">↓</span></button>
                <button className="secondary-button" type="button" onClick={shareResult}>{t.share}<span aria-hidden="true">↗</span></button>
              </div>
              {shareHint && <p className="share-hint" role="status">{shareHint}</p>}
              <button className="text-button" type="button" onClick={restart}>{t.again}</button>
            </div>
          )}
        </aside>
      </section>

      <footer><span>✦</span>{t.footer}<span>✦</span></footer>

      {crop && (
        <div className="crop-overlay" role="dialog" aria-modal="true" aria-labelledby="crop-title">
          <section className="crop-card">
            <p className="eyebrow">{t.photo}</p>
            <h2 id="crop-title">{t.cropTitle}</h2>
            <p>{t.cropHelp}</p>
            <div className="crop-stage">
              <canvas ref={canvasRef} width={720} height={720} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
              <span aria-hidden="true" />
            </div>
            <label className="zoom-control"><span>{t.zoom}</span><input type="range" min="1" max="2.5" step=".01" value={crop.zoom} onChange={(event) => setCrop({ ...crop, zoom: Number(event.target.value) })} /></label>
            <div className="crop-actions">
              <button className="secondary-button" type="button" onClick={cancelCrop}>{t.cropCancel}</button>
              <button className="primary-button" type="button" onClick={confirmCrop}>{t.cropConfirm}</button>
            </div>
          </section>
        </div>
      )}

      <dialog ref={termsRef} className="terms-dialog">
        <form method="dialog">
          <button className="dialog-close" aria-label={t.close}>×</button>
          <p className="eyebrow">Magia</p>
          <h2>{t.termsTitle}</h2>
          <p>{t.termsBody}</p>
          <button className="primary-button" value="close">{t.close}</button>
        </form>
      </dialog>
    </main>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isHeic(file: File) {
  return ["image/heic", "image/heif"].includes(file.type) || /\.(heic|heif)$/i.test(file.name);
}

function isAcceptedPhoto(file: File) {
  return ACCEPTED_IMAGE_TYPES.includes(file.type) || isHeic(file);
}

function drawCrop(context: CanvasRenderingContext2D, crop: CropState, size: number, offsetScale: number) {
  const base = Math.max(size / crop.image.naturalWidth, size / crop.image.naturalHeight);
  const scale = base * crop.zoom;
  const width = crop.image.naturalWidth * scale;
  const height = crop.image.naturalHeight * scale;
  const maxX = Math.max(0, (width - size) / 2);
  const maxY = Math.max(0, (height - size) / 2);
  const offsetX = Math.max(-maxX, Math.min(maxX, crop.x * offsetScale));
  const offsetY = Math.max(-maxY, Math.min(maxY, crop.y * offsetScale));

  context.clearRect(0, 0, size, size);
  context.drawImage(crop.image, (size - width) / 2 + offsetX, (size - height) / 2 + offsetY, width, height);
}
