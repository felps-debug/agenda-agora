import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderClosed, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/error-page";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyList } from "@/components/painel/PageHeader";

type CategoryRow = {
  id: string;
  name: string;
  active: boolean;
};

type CategoryService = {
  id: string;
  name: string;
  category_id: string | null;
};

/**
 * Aba "Categoria": o dono cadastra categorias com um nome e vincula os
 * serviços já cadastrados (liga/desliga). Um serviço fica em no máximo
 * uma categoria; desligar devolve para "sem categoria".
 */
export function ServiceCategories({
  businessId,
  services,
}: {
  businessId: string;
  services: CategoryService[];
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CategoryRow | null>(null);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);

  const { data: categories } = useQuery({
    queryKey: ["service-categories", businessId],
    queryFn: async () => {
      // Degradê seguro: se a migration ainda não foi aplicada, segue sem
      // categorias em vez de exibir erro.
      try {
        const { data, error } = await supabase
          .from("service_categories")
          .select("*")
          .eq("business_id", businessId)
          .order("position")
          .order("created_at");
        if (error) throw error;
        return data as CategoryRow[];
      } catch {
        return [] as CategoryRow[];
      }
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["service-categories", businessId] });
    void queryClient.invalidateQueries({ queryKey: ["services", businessId] });
  };

  const openNew = () => {
    setEditing(null);
    setName("");
    setActive(true);
    setLinkedIds([]);
    setDialogOpen(true);
  };

  const openEdit = (c: CategoryRow) => {
    setEditing(c);
    setName(c.name);
    setActive(c.active);
    setLinkedIds(services.filter((s) => s.category_id === c.id).map((s) => s.id));
    setDialogOpen(true);
  };

  const toggleLink = (serviceId: string) =>
    setLinkedIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId],
    );

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Informe o nome da categoria.");
      let categoryId: string;
      if (editing) {
        const { error } = await supabase
          .from("service_categories")
          .update({ name: trimmed, active })
          .eq("id", editing.id);
        if (error) throw error;
        categoryId = editing.id;
      } else {
        const { data, error } = await supabase
          .from("service_categories")
          .insert({ business_id: businessId, name: trimmed, active })
          .select("id")
          .single();
        if (error) throw error;
        categoryId = data.id;
      }
      const prevIds = new Set(
        services.filter((s) => s.category_id === categoryId).map((s) => s.id),
      );
      const nextIds = new Set(linkedIds);
      const toLink = [...nextIds].filter((id) => !prevIds.has(id));
      const toUnlink = [...prevIds].filter((id) => !nextIds.has(id));
      if (toLink.length > 0) {
        const { error } = await supabase
          .from("services")
          .update({ category_id: categoryId })
          .in("id", toLink);
        if (error) throw error;
      }
      if (toUnlink.length > 0) {
        const { error } = await supabase
          .from("services")
          .update({ category_id: null })
          .in("id", toUnlink);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Categoria salva.");
      setDialogOpen(false);
      refresh();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase
        .from("service_categories")
        .update({ active: next })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Os serviços vinculados voltam para "sem categoria" (ON DELETE SET NULL).
      const { error } = await supabase.from("service_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria removida.");
      setConfirmDelete(null);
      refresh();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  return (
    <>
      <div className="relative z-10 border-b border-[#25272d] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="professional-icon-box !size-9">
              <FolderClosed className="size-4" strokeWidth={2} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-[0.98rem] font-semibold text-[var(--c-eef0f4)]">Categorias</h2>
              <p className="mt-0.5 text-xs text-[#62656e]">
                Separe os serviços em grupos exibidos no agendamento.
              </p>
            </div>
          </div>
          <Button
            className="rounded-xl border border-[var(--c-rgba-51-125-255-a0d29)] bg-[var(--c-rgba-22-119-255-a0d09)] text-[var(--c-69a2ff)] shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_0_18px_var(--c-rgba-22-119-255-a0d08)] hover:border-[var(--c-rgba-51-125-255-a0d5)] hover:bg-[var(--c-rgba-22-119-255-a0d14)] hover:text-[var(--c-8fb5ff)]"
            onClick={openNew}
          >
            <Plus className="size-4" strokeWidth={2.2} /> Nova categoria
          </Button>
        </div>
      </div>

      {!categories?.length ? (
        <div className="p-4">
          <EmptyList text="Nenhuma categoria cadastrada." />
        </div>
      ) : (
        <div className="relative z-10 divide-y divide-[var(--c-22252b)]">
          {categories.map((c) => {
            const count = services.filter((s) => s.category_id === c.id).length;
            return (
              <div key={c.id} className="professional-person-row">
                <div className="professional-avatar">
                  <FolderClosed className="size-4" strokeWidth={1.8} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--c-eef0f3)]">{c.name}</p>
                    {!c.active && <span className="professional-badge">Inativa</span>}
                  </div>
                  <p className="mt-1 text-xs text-[#686b74]">
                    {count} serviço(s) vinculado(s)
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-[#70737b]">
                  Ativa{" "}
                  <Switch
                    checked={c.active}
                    onCheckedChange={(next) => toggleActive.mutate({ id: c.id, next })}
                  />
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="professional-icon-action"
                  onClick={() => openEdit(c)}
                  aria-label={`Editar ${c.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="professional-icon-action hover:!text-red-400"
                  onClick={() => setConfirmDelete(c)}
                  aria-label={`Remover ${c.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="professional-dialog max-h-[92vh] max-w-lg overflow-y-auto p-0">
          <DialogHeader className="professional-dialog-header">
            <div className="flex items-start gap-3 text-left">
              <div className="professional-dialog-icon">
                <FolderClosed className="size-[1.05rem]" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[var(--c-f1f2f4)]">
                  {editing ? "Editar categoria:" : "Cadastro de categoria:"}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-5 px-4 pb-2 sm:px-5">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nome de categoria:</Label>
              <Input
                id="category-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Cabelo"
                maxLength={60}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
              <Switch checked={active} onCheckedChange={setActive} />
              Ativar categoria
            </label>
            <div className="space-y-2">
              <Label>Serviços de categoria:</Label>
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum serviço cadastrado ainda.
                </p>
              ) : (
                <ul className="space-y-1">
                  {services.map((s) => {
                    const on = linkedIds.includes(s.id);
                    return (
                      <li key={s.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 text-sm hover:bg-white/[0.03]">
                          <Switch checked={on} onCheckedChange={() => toggleLink(s.id)} />
                          <span className={on ? "font-medium" : "text-muted-foreground"}>
                            {s.name}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter className="professional-dialog-footer">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Fechar
            </Button>
            <Button
              className="professional-primary-button"
              onClick={() => save.mutate()}
              disabled={!name.trim() || save.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent className="professional-dialog max-w-md p-0">
          <DialogHeader className="professional-dialog-header">
            <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[var(--c-f1f2f4)]">
              Remover categoria?
            </DialogTitle>
          </DialogHeader>
          <p className="px-4 text-sm text-muted-foreground sm:px-5">
            {confirmDelete
              ? `“${confirmDelete.name}” será removida e os serviços vinculados voltam para sem categoria.`
              : null}
          </p>
          <DialogFooter className="professional-dialog-footer">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
              disabled={remove.isPending}
            >
              Remover categoria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
