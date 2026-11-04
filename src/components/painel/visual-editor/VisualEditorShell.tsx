import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, Home, SlidersHorizontal, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type VisualPreviewScreen = "principal" | "informacoes";

/** Desktop is a split editor; touch devices are deliberately preview-first with a drawer. */
export function VisualEditorShell({
  children,
  preview,
  previewScreen,
  onPreviewScreenChange,
  dirty,
  onUndo,
  onPublish,
  publishing,
  mobileControlsOpen,
  onMobileControlsOpenChange,
  mobilePanelTitle = "Editar aparência",
}: {
  children: ReactNode;
  preview: ReactNode;
  previewScreen: VisualPreviewScreen;
  onPreviewScreenChange: (screen: VisualPreviewScreen) => void;
  dirty: boolean;
  onUndo?: () => void;
  onPublish: () => void;
  publishing: boolean;
  mobileControlsOpen: boolean;
  onMobileControlsOpenChange: (open: boolean) => void;
  mobilePanelTitle?: string;
}) {
  const [eyedropperActive, setEyedropperActive] = useState(false);
  useEffect(() => {
    const start = () => setEyedropperActive(true);
    const end = () => setEyedropperActive(false);
    window.addEventListener("appearance-eyedropper-start", start);
    window.addEventListener("appearance-eyedropper-end", end);
    return () => {
      window.removeEventListener("appearance-eyedropper-start", start);
      window.removeEventListener("appearance-eyedropper-end", end);
    };
  }, []);
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--c-f8fafc)] text-[var(--c-020617)] dark:bg-[var(--c-020617)] dark:text-[var(--c-f8fafc)]">
      {!eyedropperActive && (
        <header className="sticky top-[4.5rem] z-20 border-b bg-background/95 px-3 py-2 backdrop-blur sm:px-6 sm:py-3">
          <div className="mx-auto flex max-w-[1600px] items-center gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold sm:text-lg">Editor do Painel 1</p>
              <p className="hidden text-sm text-muted-foreground sm:block">
                {dirty ? "Alterações não publicadas" : "Tudo publicado"}
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="shrink-0"
              onClick={onUndo}
              disabled={!dirty || publishing}
              aria-label="Desfazer"
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              onClick={onPublish}
              disabled={publishing || !dirty}
            >
              {publishing ? (
                "Aplicando..."
              ) : (
                <>
                  <span className="sm:hidden">Aplicar</span>
                  <span className="hidden sm:inline">Aplicar alterações</span>
                </>
              )}
            </Button>
          </div>
        </header>
      )}

      <div
        className={`mx-auto grid max-w-[1600px] gap-6 p-0 ${
          eyedropperActive ? "" : "lg:grid-cols-[410px_minmax(0,1fr)]"
        } lg:p-6`}
      >
        {!eyedropperActive && <aside className="hidden min-w-0 lg:block">{children}</aside>}
        <section
          id="visual-editor-preview"
          tabIndex={-1}
          className="order-first min-w-0 px-3 pb-24 pt-3 outline-none lg:order-none lg:sticky lg:top-[9.5rem] lg:self-start lg:p-0"
        >
          <div className="mb-3 flex items-center justify-between gap-2 lg:mb-4">
            <div>
              <h1 className="text-lg font-bold sm:text-2xl">Prévia ao vivo</h1>
              <p className="hidden text-sm text-muted-foreground sm:block">
                As mudanças aparecem aqui antes de publicar.
              </p>
            </div>
            <div
              className="inline-flex rounded-xl border bg-background p-1"
              role="group"
              aria-label="Tamanho da prévia"
            >
              <Button
                type="button"
                size="sm"
                variant={previewScreen === "principal" ? "default" : "ghost"}
                onClick={() => onPreviewScreenChange("principal")}
              >
                <Home className="size-4" />
                <span className="hidden sm:inline">Principal</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewScreen === "informacoes" ? "default" : "ghost"}
                onClick={() => onPreviewScreenChange("informacoes")}
              >
                <CalendarDays className="size-4" />
                <span className="hidden sm:inline">Informações</span>
              </Button>
            </div>
          </div>
          <div className="min-h-[calc(100dvh-10rem)] rounded-2xl border bg-[var(--c-e2e8f0)]/70 p-2 shadow-inner dark:bg-[var(--c-0f172a)] sm:p-3 lg:min-h-0 lg:rounded-3xl">
            <div className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-[430px] flex-col overflow-y-auto rounded-[1.5rem] border-4 border-[var(--c-020617)] bg-background shadow-2xl sm:rounded-[2rem] sm:border-8 lg:h-auto lg:min-h-0 transition-all duration-300 ease-out slide-up-enter">
              {preview}
            </div>
          </div>
        </section>
      </div>

      {!eyedropperActive && (
        <>
          {!eyedropperActive && (
            <Button
              type="button"
              className="fixed bottom-4 left-4 right-4 z-20 h-12 shadow-xl lg:hidden"
              onClick={() => onMobileControlsOpenChange(!mobileControlsOpen)}
            >
              <SlidersHorizontal className="size-4" />{" "}
              {mobileControlsOpen ? "Fechar edição" : "Editar aparência"}
            </Button>
          )}
          {mobileControlsOpen && !eyedropperActive && (
            <div className="mx-auto max-w-[430px] px-3 pb-8 lg:hidden">
              <div className="rounded-2xl border bg-background p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold">{mobilePanelTitle}</p>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="shrink-0"
                    aria-label="Fechar edição"
                    onClick={() => onMobileControlsOpenChange(false)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="space-y-4">{children}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
