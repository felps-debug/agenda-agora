export type EnsaioMigration = { name: string; path: string };
export type Ensaio = {
  url: string;
  applied: string[];
  failures: Array<{ name: string; message: string }>;
  stop: () => Promise<void>;
};
export function ensureTooling(): void;
export function loadPg(): unknown;
export function migrationFiles(dir?: string): EnsaioMigration[];
export function startEnsaio(options?: { port?: number; migrations?: EnsaioMigration[] }): Promise<Ensaio>;
