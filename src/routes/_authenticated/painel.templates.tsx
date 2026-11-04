import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  Brush,
  ChevronRight,
  Download,
  Eye,
  Flower2,
  Hand,
  Palette,
  PawPrint,
  PenTool,
  Scissors,
  Sparkles,
  Sun,
} from "lucide-react";
import { useBusiness } from "@/lib/business";
import { NoBusiness } from "@/components/painel/PageHeader";
import { AgpayBackground } from "@/components/painel/AgpayBackground";
import { listNicheAssets } from "@/lib/niche-assets";

export const Route = createFileRoute("/_authenticated/painel/templates")({
  head: () => ({
    meta: [
      { title: "Templates — Agenda Agora" },
      { name: "description", content: "Escolha um nicho e baixe as artes disponíveis." },
    ],
  }),
  loader: async () => ({ assets: await listNicheAssets() }),
  component: TemplatesPage,
});

// Vitrine de nichos no formato de app do cliente. Ao tocar num nicho (ou na
// seta do destaque), abre a tela do nicho com as artes para download.
type TemplateCategory = {
  id: string;
  name: string;
  /** Nome curto exibido no chip de nicho e no título da tela do nicho. */
  short: string;
  /** Foto de destaque do nicho (aparece no cartão de pré-visualização). */
  image: string;
  icon: LucideIcon;
  keywords: string[];
};

type NicheAssetKind = "template" | "foto";

type NicheAsset = {
  id: string;
  title: string;
  kind: NicheAssetKind;
  /** Caminho do arquivo em /public (ex.: /templates/barbearia/combo.png). */
  image: string;
};

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    id: "sobrancelha",
    name: "DESIGNER DE SOMBRANCELHA",
    short: "Sobrancelha",
    image: "/templates/nichos/sobrancelha.png",
    icon: Brush,
    keywords: ["sobrancelha", "design", "henna", "brow"],
  },
  {
    id: "lash",
    name: "LASH DESIGNER - CÍLIOS",
    short: "Cílios",
    image: "/templates/nichos/lash.jpg",
    icon: Eye,
    keywords: ["cilio", "lash", "pestana", "volume", "hibrid"],
  },
  {
    id: "manicure",
    name: "MANICURE/NAIL DESIGNER",
    short: "Manicure",
    image: "/templates/nichos/manicure.jpg",
    icon: Hand,
    keywords: ["unha", "manicure", "alongamento", "esmaltacao", "nail", "gel", "fibra"],
  },
  {
    id: "cabeleireiro",
    name: "CABELEIREIRO(A)",
    short: "Cabelo",
    image: "/templates/nichos/cabeleireiro.png",
    icon: Scissors,
    keywords: ["cabelo", "corte", "escova", "alisamento", "coloracao", "mechas", "luzes", "cauterizacao"],
  },
  {
    id: "maquiadora",
    name: "MAQUIADORA",
    short: "Maquiadora",
    image: "/templates/nichos/maquiadora.png",
    icon: Palette,
    keywords: ["maquiagem", "maquiadora", "maqui", "noiva", "social"],
  },
  {
    id: "bronze",
    name: "BRONZE/DEPILAÇÃO",
    short: "Bronze",
    image: "/templates/nichos/bronze.jpg",
    icon: Sun,
    keywords: ["bronze", "depenilacao", "cera", "laser", "pele"],
  },
  {
    id: "barbearia",
    name: "BARBEARIA",
    short: "Barbearia",
    image: "/templates/nichos/barbearia.jpg",
    icon: Scissors,
    keywords: ["barba", "barbeiro", "barbearia", "masculino", "degrade", "navalha"],
  },
  {
    id: "tatuador",
    name: "TATUADOR",
    short: "Tatuador",
    image: "/templates/nichos/tatuador.jpg",
    icon: PenTool,
    keywords: ["tatuagem", "tattoo", "tatuador", "micropigmentacao"],
  },
  {
    id: "estetica",
    name: "ESTÉTICA/BOTOX",
    short: "Estética",
    image: "/templates/nichos/estetica.png",
    icon: Sparkles,
    keywords: ["estetica", "botox", "preenchimento", "limpeza de pele", "skincare", "peeling"],
  },
  {
    id: "massagem",
    name: "MASSAGEM/SPA",
    short: "Massagem",
    image: "/templates/nichos/massagem.jpg",
    icon: Flower2,
    keywords: ["massagem", "spa", "relaxante", "drenagem", "shiatsu", "reflexologia"],
  },
  {
    id: "petshop",
    name: "PETSHOP",
    short: "Petshop",
    image: "/templates/nichos/petshop.jpg",
    icon: PawPrint,
    keywords: ["pet", "cachorro", "gato", "banho", "tosa", "veterin"],
  },
];

/** Artes carregadas dinamicamente das pastas public/templates/<nicho>/* */

/** Abas de filtro da tela do nicho, na ordem do mock. */
const ASSET_TABS = [
  { id: "todos", label: "Todos" },
  { id: "template", label: "Templates prontos" },
  { id: "foto", label: "Fotos de serviços" },
] as const;

type AssetTabId = (typeof ASSET_TABS)[number]["id"];

function TemplatesPage() {
  const { businessId } = useBusiness();
  const { assets: nicheAssetsMap } = Route.useLoaderData();
  /** Nicho marcado na vitrine (só o anel de seleção, não abre tela). */
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  /** Nicho com a tela de artes aberta (só muda pela seta do destaque). */
  const [openNicheId, setOpenNicheId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AssetTabId>("todos");

  if (!businessId) return <NoBusiness />;

  const openCategory =
    TEMPLATE_CATEGORIES.find((category) => category.id === openNicheId) ?? null;

  /** Destaque: nicho marcado, ou Sobrancelha quando nada está marcado. */
  const featured = TEMPLATE_CATEGORIES.find((category) => category.id === activeCategoryId) ?? null;
  const featuredImage = featured?.image ?? "/lash-treatment.jpg";
  const featuredLabel = featured?.short ?? "Design de Sobrancelhas";

  /** Marca/desmarca o nicho na vitrine (só o anel de seleção). */
  const toggleCategory = (id: string) => {
    setActiveCategoryId((current) => (current === id ? null : id));
  };

  /** Abre a tela de artes do nicho marcado (seta do destaque). */
  const openAssets = () => {
    setOpenNicheId(activeCategoryId ?? "sobrancelha");
    setActiveTab("todos");
  };

  /** Volta da tela de artes para a vitrine (mantém o nicho marcado). */
  const closeAssets = () => {
    setOpenNicheId(null);
    setActiveTab("todos");
  };

  /* ---------------------------------------------------------------------- */
  /* Tela do nicho: filtros + grade de artes para download                  */
  /* ---------------------------------------------------------------------- */
  if (openCategory) {
    const assets = (nicheAssetsMap as Record<string, NicheAsset[]>)[openCategory.id] ?? [];
    const templatesCount = assets.filter((a) => a.kind === "template").length;
    const fotosCount = assets.filter((a) => a.kind === "foto").length;
    const visibleAssets =
      activeTab === "todos" ? assets : assets.filter((asset) => asset.kind === activeTab);

    return (
      <div className="tpl-cream-page py-2">
        <div className="rounded-[2rem] border border-white/10 bg-[#0a0c10] p-5 sm:p-7">
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              onClick={() => closeAssets()}
              className="absolute left-0 flex items-center gap-1.5 rounded-lg text-sm font-semibold text-white/85 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <ArrowLeft className="size-4" />
              Voltar
            </button>
            <h1 className="text-lg font-bold text-white sm:text-xl">{openCategory.short}</h1>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("todos")}
              aria-pressed={activeTab === "todos"}
              className={
                activeTab === "todos"
                  ? "rounded-full bg-[#2dd4bf] px-4 py-1.5 text-xs font-bold text-[#05231e] shadow-[0_0_14px_rgba(45,212,191,0.35)]"
                  : "rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-white/75 transition-colors hover:border-white/30 hover:text-white"
              }
            >
              Todos{assets.length ? ` (${assets.length})` : ""}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("template")}
              aria-pressed={activeTab === "template"}
              className={
                activeTab === "template"
                  ? "rounded-full bg-[#2dd4bf] px-4 py-1.5 text-xs font-bold text-[#05231e] shadow-[0_0_14px_rgba(45,212,191,0.35)]"
                  : "rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-white/75 transition-colors hover:border-white/30 hover:text-white"
              }
            >
              Templates prontos{templatesCount ? ` (${templatesCount})` : ""}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("foto")}
              aria-pressed={activeTab === "foto"}
              className={
                activeTab === "foto"
                  ? "rounded-full bg-[#2dd4bf] px-4 py-1.5 text-xs font-bold text-[#05231e] shadow-[0_0_14px_rgba(45,212,191,0.35)]"
                  : "rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-white/75 transition-colors hover:border-white/30 hover:text-white"
              }
            >
              Fotos de serviços{fotosCount ? ` (${fotosCount})` : ""}
            </button>
          </div>

          {visibleAssets.length === 0 ? (
            <p className="mt-8 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-sm text-muted-foreground">
              Nenhuma arte disponível ainda para este nicho.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {visibleAssets.map((asset) => (
                <figure
                  key={asset.id}
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/40"
                >
                  <img
                    src={asset.image}
                    alt={asset.title}
                    loading="lazy"
                    className="aspect-[9/16] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <a
                    href={asset.image}
                    download={
                      asset.image.split("/").pop() ??
                      `agenda-agora-${openCategory.id}-${asset.id}${asset.image.endsWith(".webp") ? ".webp" : asset.image.endsWith(".jpg") ? ".jpg" : asset.image.endsWith(".jpeg") ? ".jpeg" : asset.image.endsWith(".png") ? ".png" : ".png"}`
                    }
                    aria-label={`Baixar ${asset.title}`}
                    className="absolute bottom-2.5 right-2.5 grid size-10 place-items-center rounded-full bg-[#2dd4bf] text-[#05231e] shadow-[0_0_16px_rgba(45,212,191,0.45)] transition-transform hover:scale-105"
                  >
                    <Download className="size-5" strokeWidth={2.4} />
                  </a>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Tela principal: vitrine de nichos                                      */
  /* ---------------------------------------------------------------------- */
  return (
    <div className="tpl-cream-page space-y-6 py-2">
      {/* Hero em tela cheia — mesmo formato do menu Mensagens, em marrom. */}
      <section
        aria-label="Templates premium"
        className="tpl-hero-brown relative w-full px-6 pb-8 pt-10"
      >
        <AgpayBackground
          /* Transição tema -> marrom/cream, igual à abertura do Carteira/Lembretes. */
          morphFromTheme
          morphAccentTo="#89735f"
          morphLightTo="#f6f1ea"
          morphDelayMs={500}
          morphDurationMs={1200}
          canvasClassName="pointer-events-none absolute inset-x-0 top-0 z-[1] w-full"
          words={[
            "TEMPLATES",
            "PREMIUM",
            "DIVULGAÇÃO",
            "ARTE",
            "TEMPLATES",
            "NICHO",
            "PREMIUM",
          ]}
        />
        <div className="relative z-10 mx-auto max-w-xl text-center">
          <p className="lembretes-hero-eyebrow lembretes-fade-slide-up lembretes-delay-1">
            Templates <span className="ew-white">Premium</span>{" "}
            <span className="ew-white">Divulgação</span>
          </p>
          <h1 className="lembretes-hero-title lembretes-fade-slide-up lembretes-delay-2 mx-auto mt-4 max-w-md">
            Baixe artes <span>Prontas</span>
          </h1>
          <p className="lembretes-hero-sub lembretes-fade-slide-up lembretes-delay-3 mx-auto mt-6 max-w-md">
            O menu Templates reúne artes de divulgação e fotos de serviços do seu
            segmento. Escolha o seu nicho, baixe a arte e use nas suas redes
            sociais e no WhatsApp — sem precisar de designer.
          </p>
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("templates-vitrine")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="lembretes-btn-solid lembretes-fade-slide-up lembretes-delay-4 mt-10"
          >
            Escolher Nicho
            <ChevronRight className="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Como funciona abaixo"
            className="lembretes-aviso-outline mt-10"
          >
            Como Funciona
          </button>
          <div className="lembretes-scroll-cue lembretes-fade-slide-up lembretes-delay-6 mt-10">
            <span>Scroll</span>
            <span aria-hidden="true" className="lembretes-scroll-line" />
          </div>
          <div className="lembretes-fade-slide-up lembretes-delay-7 mx-auto mt-14 max-w-md text-left">
            <p className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-block h-px w-10 shrink-0 bg-[#a08e7e] shadow-[0_0_8px_rgba(160,142,126,0.63)]"
              />
              <span className="lembretes-hero-eyebrow" style={{ textIndent: 0 }}>
                Como funciona
              </span>
            </p>
            <h2 className="lembretes-hero-title small mt-3">
              Escolha <span>baixe e use</span>
            </h2>
            <p className="lembretes-hero-sub mt-4">
              Toque em um nicho, veja as artes disponíveis e baixe as que quiser.
              Use no status do WhatsApp, no feed das redes sociais e nos panfletos
              do seu negócio.
            </p>
          </div>
        </div>
      </section>

      {/* Vitrine de nichos. */}
      <div id="templates-vitrine" className="scroll-mt-6">
        <div className="w-full rounded-[2rem] border border-white/10 bg-[#f6f1ea] p-5 sm:p-8">
          <h2 className="text-2xl font-bold leading-tight text-[#3f2d1d] sm:text-[28px]">
            Bem-vindo(a)!
          </h2>
          <p className="mt-1 text-sm font-medium text-[#8a7360]">
            Seu bem-estar em primeiro lugar
          </p>

        {/* Destaque sem valor — a seta abre o nicho de Sobrancelha. */}
        <div className="relative mt-4 h-40 overflow-hidden rounded-2xl sm:h-48">
          <img
            key={featuredImage}
            src={featuredImage}
            alt={featuredLabel}
            decoding="async"
            className="aa-featured-fade absolute inset-0 size-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[#2e2114]/75 via-[#2e2114]/35 to-transparent"
          />
          <div className="relative flex h-full flex-col justify-center px-5 sm:px-7">
            <p
              key={featuredLabel}
              className="aa-featured-fade text-base font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] sm:text-lg"
            >
              {featuredLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAssets()}
            aria-label="Abrir templates do nicho selecionado"
            className={`aa-cta-pulse absolute right-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-[#f6f1ea] text-[#4a3426] shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6a45] sm:right-6 sm:size-12`}
          >
            <ArrowRight className="size-5" strokeWidth={2.2} />
          </button>
        </div>

        <h3 className="mt-5 text-lg font-bold text-[#3f2d1d] sm:text-xl">Templates Premium</h3>

        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {TEMPLATE_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isActive = category.id === activeCategoryId;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleCategory(category.id)}
                aria-pressed={isActive}
                className={`flex flex-col items-center gap-2 rounded-2xl bg-white px-1 py-4 shadow-[0_1px_3px_rgba(63,45,29,0.10)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_10px_rgba(63,45,29,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6a45] sm:py-5 ${
                  isActive ? "ring-2 ring-[#8a6a45] ring-offset-1 ring-offset-[#f6f1ea]" : ""
                }`}
              >
                <Icon className="size-7 text-[#6b4f35] sm:size-8" strokeWidth={1.8} aria-hidden="true" />
                <span className="text-[11px] font-semibold leading-tight text-[#6b5138] sm:text-xs">
                  {category.short}
                </span>
              </button>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
}
