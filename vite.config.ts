import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const supabaseUrl =
    process.env["VITE_SUPABASE_URL"] ??
    process.env["SUPABASE_URL"] ??
    fileEnv["VITE_SUPABASE_URL"] ??
    fileEnv["SUPABASE_URL"] ??
    "";
  const supabasePublishableKey =
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    fileEnv["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    fileEnv["SUPABASE_PUBLISHABLE_KEY"] ??
    "";

  return {
    resolve: { tsconfigPaths: true },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "supabase",
                test: /node_modules[\\/]@supabase[\\/]/,
                includeDependenciesRecursively: false,
                priority: 20,
              },
              {
                name: "react-query",
                test: /node_modules[\\/]@tanstack[\\/]react-query[\\/]/,
                includeDependenciesRecursively: false,
                priority: 15,
              },
              {
                name: "radix",
                test: /node_modules[\\/]@radix-ui[\\/]/,
                // Os primitivos Radix dependem uns dos outros. Separar somente
                // os pacotes @radix-ui criou um ciclo entre os chunks `radix`
                // e `select` em produção, deixando SelectPrimitive.Trigger
                // indefinido durante a hidratação. Mantê-los com as
                // dependências compartilhadas elimina esse ciclo.
                includeDependenciesRecursively: true,
                priority: 15,
              },
              {
                // Precisa incluir as dependências (d3-scale, d3-shape etc.) no
                // mesmo chunk: separá-las causa corrida no carregamento dos
                // módulos em produção ("TypeError: X is not a function"),
                // porque o código de topo da recharts roda antes das
                // dependências terminarem de carregar num chunk à parte.
                name: "recharts",
                test: /node_modules[\\/]recharts[\\/]/,
                includeDependenciesRecursively: true,
                priority: 15,
              },
            ],
          },
        },
      },
    },
    plugins: [tanstackStart({ server: { entry: "server" } }), nitro(), viteReact(), tailwindcss()],
  };
});
