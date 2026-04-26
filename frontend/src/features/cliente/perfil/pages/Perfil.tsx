import { Link } from "react-router";
import {
  UserCircle,
  Wallet,
  Images,
  User,
  Bell,
  LogOut,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import { ClienteLayout } from "@/features/cliente/components/ClienteLayout";
import { ModalDadosPessoais } from "@/features/cliente/perfil/components/ModalDadosPessoais";
import { usePerfilPage } from "@/features/cliente/perfil/hooks/usePerfilPage";

const PROMPT_MAX = 500;

export function Perfil() {
  const {
    perfil,
    isLoading,
    creditosData,
    atualizar,
    promptLocal,
    setPromptLocal,
    promptDirty,
    modalDados,
    setModalDados,
    handleLogout,
    handleSalvarPrompt,
  } = usePerfilPage();

  return (
    <ClienteLayout>
      <div className="mx-auto max-w-md space-y-5 px-4 py-6">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 py-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-600/15">
            <UserCircle size={44} className="text-violet-400" />
          </div>

          {isLoading ? (
            <div className="space-y-2 text-center">
              <div className="mx-auto h-5 w-36 animate-pulse rounded bg-zinc-800" />
              <div className="mx-auto h-3.5 w-48 animate-pulse rounded bg-zinc-800" />
            </div>
          ) : (
            <div className="text-center">
              <h1 className="text-lg font-bold text-zinc-100">
                {perfil?.nome}
              </h1>
              <p className="text-sm text-zinc-400">{perfil?.email}</p>
            </div>
          )}

          <div className="rounded-full bg-violet-600/10 px-4 py-1.5">
            <span className="text-sm font-semibold text-violet-300">
              {creditosData?.creditos ?? "—"} créditos
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">
              Como me conhecer
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              A IA usa isso para personalizar a conversa com você.
            </p>
          </div>

          <textarea
            value={promptLocal}
            onChange={(e) =>
              setPromptLocal(e.target.value.slice(0, PROMPT_MAX))
            }
            rows={4}
            placeholder="Conte um pouco sobre você para personalizar sua experiência…"
            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-600">
              {promptLocal.length}/{PROMPT_MAX}
            </span>
            <button
              onClick={handleSalvarPrompt}
              disabled={!promptDirty || atualizar.isPending}
              className={clsx(
                "rounded-xl px-4 py-1.5 text-sm font-semibold transition",
                promptDirty
                  ? "bg-violet-600 text-white hover:bg-violet-500"
                  : "cursor-default bg-transparent text-zinc-600",
              )}
            >
              {atualizar.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/cliente/carteira"
            className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/10">
              <Wallet size={18} className="text-violet-400" />
            </div>
            <span className="text-sm font-medium text-zinc-200">Carteira</span>
          </Link>

          <Link
            to="/cliente/galeria"
            className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/10">
              <Images size={18} className="text-violet-400" />
            </div>
            <span className="text-sm font-medium text-zinc-200">Galeria</span>
          </Link>

          <button
            onClick={() => setModalDados(true)}
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/10">
              <User size={18} className="text-violet-400" />
            </div>
            <span className="text-sm font-medium text-zinc-200">
              Dados pessoais
            </span>
          </button>

          <Link
            to="/cliente/notificacoes"
            className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/10">
              <Bell size={18} className="text-violet-400" />
            </div>
            <span className="text-sm font-medium text-zinc-200">
              Preferências
            </span>
          </Link>
        </div>

        <Link
          to="/cliente/carteira"
          className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 transition hover:border-zinc-700"
        >
          <span className="text-sm font-medium text-zinc-300">
            Histórico de compras
          </span>
          <ChevronRight size={16} className="text-zinc-500" />
        </Link>

        <div className="flex items-center justify-between pt-1">
          <div className="flex gap-4">
            <a
              href="#"
              className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline"
            >
              Termos de uso
            </a>
            <a
              href="#"
              className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline"
            >
              Privacidade
            </a>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </div>

      {modalDados && perfil && (
        <ModalDadosPessoais
          perfil={perfil}
          onClose={() => setModalDados(false)}
        />
      )}
    </ClienteLayout>
  );
}
