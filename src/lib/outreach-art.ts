export type OutreachArt = {
  id: string;
  name: string;
  file: `/templates/${string}`;
  description: string;
};

/** Artes estáticas de divulgação distribuídas junto com a aplicação. */
export const outreachArts: OutreachArt[] = [
  {
    id: "barbearia-52",
    name: "Barbearia — agenda aberta",
    file: "/templates/barbearia-52.png",
    description: "Arte para divulgar horários disponíveis na barbearia.",
  },
];
