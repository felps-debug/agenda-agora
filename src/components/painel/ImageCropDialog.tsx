import { useEffect, useRef, useState } from "react";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import { Loader2, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Proporções de recorte disponíveis. "Livre" mantém a caixa sem travar a
 * proporção (aspectRatio = NaN), das demais o cropper trava ao arrastar.
 */
const ASPECT_OPTIONS = [
  { id: "free", label: "Livre", ratio: Number.NaN },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
] as const;

type AspectId = (typeof ASPECT_OPTIONS)[number]["id"];

export interface ImageCropDialogProps {
  /** Mantém o modal renderizado (Radix usa Presença para a animação de saída). */
  open: boolean;
  /** Arquivo original escolhido no input; o recorte parte dele. */
  file: File | null;
  /** Upload em andamento no fluxo que abriu o modal. */
  busy: boolean;
  /** Mensagem de erro do upload, exibida dentro do modal. */
  error: string | null;
  onCancel: () => void;
  /** Recebe o recorte pronto para upload (PNG ou JPEG). */
  onConfirm: (blob: Blob, extension: "png" | "jpg") => void;
  /**
   * Quando definido, trava a proporção do recorte nesse valor (ex.: 1 para
   * logos) e esconde o seletor de proporções. Usado para logotipos de temas.
   */
  fixedAspect?: number | undefined;
  /** Forma visual da caixa de recorte (redonda ou com cantos arredondados). */
  cropShape?: "round" | "rounded" | undefined;
}
/**
 * Modal de recorte de imagem usado antes do upload da foto de um serviço.
 * Intercepta o arquivo escolhido, permite ajustar a caixa (arrastar + redimensionar
 * pelos 8 pontos), aplicar zoom/rotação e só então devolve o recorte para o upload.
 */
export function ImageCropDialog({
  open,
  file,
  busy,
  error,
  onCancel,
  onConfirm,
  fixedAspect,
  cropShape,
}: ImageCropDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Fechar pelo X/ESC/overlay só é permitido quando não há upload em andamento.
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent
        className={`image-crop-dialog ${
          cropShape ? `image-crop-shape-${cropShape}` : ""
        } gap-0 overflow-hidden rounded-2xl p-0 sm:rounded-2xl`}
      >
        <DialogHeader className="image-crop-dialog-header text-left">
          <DialogTitle className="text-base">Recortar Imagem</DialogTitle>
          <DialogDescription className="text-xs">
            Ajuste o enquadramento, aplique zoom ou gire a imagem antes de salvar.
          </DialogDescription>
        </DialogHeader>
        {file ? (
          <CropperBody
            file={file}
            busy={busy}
            error={error}
            onCancel={onCancel}
            onConfirm={onConfirm}
            fixedAspect={fixedAspect}
          />
        ) : (
          <div className="h-48" />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CropperBody({
  file,
  busy,
  error,
  onCancel,
  onConfirm,
  fixedAspect,
}: {
  file: File;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (blob: Blob, extension: "png" | "jpg") => void;
  fixedAspect?: number | undefined;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [aspect, setAspect] = useState<AspectId>(fixedAspect ? "1:1" : "free");

  // Uma URL por arquivo; revogada quando o corpo do modal desmonta.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    setReady(false);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Garante a destruição do cropper (ele manipula o DOM por conta própria).
  useEffect(
    () => () => {
      cropperRef.current?.destroy();
      cropperRef.current = null;
    },
    [],
  );

  const handleImageLoad = () => {
    const image = imgRef.current;
    if (!image) return;
    cropperRef.current?.destroy();
    cropperRef.current = new Cropper(image, {
      ...(fixedAspect ? { aspectRatio: fixedAspect } : {}),
      viewMode: 1,
      dragMode: "move",
      responsive: true,
      autoCrop: true,
      autoCropArea: 0.85,
      background: true,
      modal: true,
      guides: true,
      center: true,
      highlight: true,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      zoomable: true,
      zoomOnTouch: true,
      zoomOnWheel: true,
      rotatable: true,
      scalable: false,
      wheelZoomRatio: 0.1,
      minContainerHeight: 260,
      minCropBoxWidth: 48,
      minCropBoxHeight: 48,
      ready: () => setReady(true),
    });
  };

  const changeAspect = (id: AspectId) => {
    setAspect(id);
    const option = ASPECT_OPTIONS.find((item) => item.id === id);
    if (option) cropperRef.current?.setAspectRatio(option.ratio);
  };

  const handleSave = async () => {
    const cropper = cropperRef.current;
    if (!cropper || busy || !ready) return;
    // PNG preserva transparência; demais formatos viram JPEG (arquivo menor).
    const keepAlpha = file.type === "image/png";
    const mime = keepAlpha ? "image/png" : "image/jpeg";
    const extension = keepAlpha ? "png" : "jpg";
    const canvas = cropper.getCroppedCanvas({
      maxWidth: 2048,
      maxHeight: 2048,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
      // fillColor só para JPEG (não existe canal alfa); em PNG mantemos a transparência.
      ...(keepAlpha ? {} : { fillColor: "#ffffff" }),
    });
    try {
      const blob = await new Promise<Blob | null>((resolve, reject) => {
        try {
          canvas.toBlob((result) => resolve(result), mime, keepAlpha ? undefined : 0.92);
        } catch (error) {
          reject(error);
        }
      });
      if (!blob) {
        throw new Error("Não foi possível gerar o recorte da imagem.");
      }
      onConfirm(blob, extension);
    } catch (error) {
      console.error("Erro ao recortar imagem:", error);
      // Mantém modal aberto e avisa — usuário pode tentar novamente.
      // Não reusa a prop `error` do upload pois é específica do fluxo final.
      alert(error instanceof Error ? error.message : "Erro ao recortar imagem.");
    }
  };

  return (
    <>
      <div className="image-crop-dialog-body">
        <div className="image-crop-stage-wrap">
          <div className="image-crop-stage">
            {src ? (
              <img
                ref={imgRef}
                src={src}
                alt="Imagem selecionada para recorte"
                onLoad={handleImageLoad}
              />
            ) : null}
            {!ready && (
              <div className="image-crop-loading">
                <Loader2 className="size-6 animate-spin-custom" />
              </div>
            )}
          </div>

          <div className="image-crop-toolbar">
            {fixedAspect ? null : (
              <div className="image-crop-aspects" role="group" aria-label="Proporção do recorte">
                {ASPECT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={aspect === option.id ? "is-active" : ""}
                    onClick={() => changeAspect(option.id)}
                    disabled={!ready || busy}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            <div className="image-crop-controls">
              <button
                type="button"
                title="Afastar"
                aria-label="Afastar"
                onClick={() => cropperRef.current?.zoom(-0.1)}
                disabled={!ready || busy}
              >
                <ZoomOut />
              </button>
              <button
                type="button"
                title="Aproximar"
                aria-label="Aproximar"
                onClick={() => cropperRef.current?.zoom(0.1)}
                disabled={!ready || busy}
              >
                <ZoomIn />
              </button>
              <button
                type="button"
                title="Girar para a esquerda"
                aria-label="Girar para a esquerda"
                onClick={() => cropperRef.current?.rotate(-90)}
                disabled={!ready || busy}
              >
                <RotateCcw />
              </button>
              <button
                type="button"
                title="Girar para a direita"
                aria-label="Girar para a direita"
                onClick={() => cropperRef.current?.rotate(90)}
                disabled={!ready || busy}
              >
                <RotateCw />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="image-crop-error">
            {error}
          </p>
        )}
      </div>

      <DialogFooter className="image-crop-dialog-footer">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button
          type="button"
          className="professional-primary-button"
          onClick={handleSave}
          disabled={!ready || busy}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Salvando...
            </>
          ) : (
            "Salvar"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
