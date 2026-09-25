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
            ],
          },
        },
      },
    },
    plugins: [tanstackStart({ server: { entry: "server" } }), nitro(), viteReact(), tailwindcss()],
  };
});
