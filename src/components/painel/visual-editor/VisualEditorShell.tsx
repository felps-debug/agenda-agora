import type { ReactNode } from "react";
import { Monitor, SlidersHorizontal, Smartphone, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export type VisualPreviewMode = "mobile" | "desktop";

/** Desktop is a split editor; touch devices are deliberately preview-first with a drawer. */
export function VisualEditorShell({
  children,
  preview,
  previewMode,
  onPreviewModeChange,
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
  previewMode: VisualPreviewMode;
  onPreviewModeChange: (mode: VisualPreviewMode) => void;
  dirty: boolean;
  onUndo?: () => void;
  onPublish: () => void;
  publishing: boolean;
  mobileControlsOpen: boolean;
  onMobileControlsOpenChange: (open: boolean) => void;
  mobilePanelTitle?: string;
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
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

      <div className="mx-auto grid max-w-[1600px] gap-6 p-0 lg:grid-cols-[410px_minmax(0,1fr)] lg:p-6">
        <aside className="hidden min-w-0 lg:block">{children}</aside>
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
                variant={previewMode === "mobile" ? "default" : "ghost"}
                onClick={() => onPreviewModeChange("mobile")}
              >
                <Smartphone className="size-4" />
                <span className="hidden sm:inline">Celular</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewMode === "desktop" ? "default" : "ghost"}
                onClick={() => onPreviewModeChange("desktop")}
              >
                <Monitor className="size-4" />
                <span className="hidden sm:inline">Desktop</span>
              </Button>
            </div>
          </div>
          <div className="min-h-[calc(100dvh-10rem)] rounded-2xl border bg-slate-200/70 p-2 shadow-inner dark:bg-slate-900 sm:p-3 lg:min-h-0 lg:rounded-3xl">
            <div
              className={
                previewMode === "mobile"
                  ? "mx-auto min-h-[calc(100dvh-12rem)] max-w-[430px] overflow-hidden rounded-[1.5rem] border-4 border-slate-950 bg-background shadow-2xl sm:rounded-[2rem] sm:border-8 lg:min-h-0"
                  : "mx-auto max-w-5xl overflow-hidden rounded-2xl border bg-background shadow-xl"
              }
            >
              {preview}
            </div>
          </div>
        </section>
      </div>

      <Button
        type="button"
        className="fixed bottom-4 left-4 right-4 z-20 h-12 shadow-xl lg:hidden"
        onClick={() => onMobileControlsOpenChange(true)}
      >
        <SlidersHorizontal className="size-4" /> Editar aparência
      </Button>
      <Drawer open={mobileControlsOpen} onOpenChange={onMobileControlsOpenChange}>
        <DrawerContent className="max-h-[82dvh]">
          <DrawerHeader className="flex items-center justify-between gap-3 pb-2 text-left">
            <DrawerTitle>{mobilePanelTitle}</DrawerTitle>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0"
              aria-label="Voltar para a prévia"
              onClick={() => onMobileControlsOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
