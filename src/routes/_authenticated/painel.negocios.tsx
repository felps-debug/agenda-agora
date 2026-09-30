import { useState } from "react";
import { friendlyError } from "@/lib/error-page";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Store } from "lucide-react";
import { useBusiness, type Business } from "@/lib/business";
import { CATEGORIES, categoryLabel } from "@/lib/format";
import { updateBusinessProfile } from "@/lib/business.functions";
import { PageHeader, EmptyList } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/painel/negocios")({
  head: () => ({
    meta: [
      { title: "Negócio — Agenda Agora" },
      { name: "description", content: "Edite os dados do seu estabelecimento." },
    ],
  }),
  component: NegociosPage,
});

type Form = {
  businessId: string;
  name: string;
  slug: string;
  category: string;
  phone: string;
  address: string;
};

const formFrom = (b: Business): Form => ({
  businessId: b.id,
  name: b.name,
  slug: b.slug,
  category: b.category,
  phone: b.phone ?? "",
  address: b.address ?? "",
});

function NegociosPage() {
  const { businesses, applyUpdatedBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const saveFn = useServerFn(updateBusinessProfile);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form | null>(null);

  const save = useMutation({
    mutationFn: () => saveFn({ data: form! }),
    onSuccess: (updated) => {
      toast.success("Dados do negócio atualizados!");
      setOpen(false);
      setForm(null);
      // Usa a linha salva para o cartão do link público mudar sem esperar o refetch.
      applyUpdatedBusiness(updated);
      void queryClient.invalidateQueries({ queryKey: ["public-business"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const edit = (b: Business) => {
    setForm(formFrom(b));
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Negócio"
        subtitle="Edite as informações públicas do seu estabelecimento."
      />

      {businesses.length === 0 ? (
        <EmptyList text="Seu acesso ainda não foi vinculado a um estabelecimento pelo painel Master." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {businesses.map((b) => (
            <article key={b.id} className="surface p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Store className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold">{b.name}</h2>
                  <p className="text-xs text-muted-foreground">{categoryLabel(b.category)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => edit(b)}
                  aria-label={`Editar ${b.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
              <dl className="mt-5 space-y-2 text-sm text-muted-foreground">
                {b.phone && <dd>{b.phone}</dd>}
                {b.address && <dd>{b.address}</dd>}
                <dd className="text-xs">Link público: /agendar/{b.slug}</dd>
              </dl>
            </article>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setForm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar negócio</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bname">Nome do estabelecimento</Label>
                <Input
                  id="bname"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bslug">Link público</Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">/agendar/</span>
                  <Input
                    id="bslug"
                    value={form.slug}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        slug: e.target.value
                          .toLowerCase()
                          .normalize("NFD")
                          .replace(/[̀-ͯ]/g, "")
                          .replace(/[^a-z0-9-]/g, "-"),
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Segmento</Label>
                <Select
                  value={form.category}
                  onValueChange={(category) => setForm({ ...form, category })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bphone">Telefone</Label>
                  <Input
                    id="bphone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baddress">Endereço</Label>
                  <Input
                    id="baddress"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => save.mutate()}
              disabled={
                !form ||
                form.name.trim().length < 2 ||
                form.slug.trim().length < 3 ||
                save.isPending
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
