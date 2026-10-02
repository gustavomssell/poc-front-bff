"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { MonitorIcon, MoonIcon, RefreshCwIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

const AUTO_REFRESH_MS = 60_000;

const THEMES = ["light", "dark", "system"] as const;
type ThemeName = (typeof THEMES)[number];

const THEME_PT: Record<ThemeName, string> = {
  light: "claro",
  dark: "escuro",
  system: "sistema",
};

/** Evita divergência de hidratação: o tema só existe no cliente. */
const subscribeNoop = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const current: ThemeName = (THEMES as readonly string[]).includes(
    theme ?? "system",
  )
    ? (theme as ThemeName)
    : "system";
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={
        mounted
          ? `Tema ${THEME_PT[current]} — alternar para ${THEME_PT[next]}`
          : "Alternar tema"
      }
      title={mounted ? `Tema: ${THEME_PT[current]}` : "Alternar tema"}
    >
      {!mounted ? (
        <span className="size-4" aria-hidden />
      ) : current === "system" ? (
        <MonitorIcon className="size-4" />
      ) : resolvedTheme === "dark" ? (
        <SunIcon className="size-4" />
      ) : (
        <MoonIcon className="size-4" />
      )}
    </Button>
  );
}


export function TopBarActions() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Primeiro tick assíncrono evita divergência de hidratação no servidor.
    const tick = () => setNow(new Date());
    const initial = setTimeout(tick, 0);
    const clock = setInterval(tick, 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => startTransition(() => router.refresh()), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  const refresh = () => startTransition(() => router.refresh());

  return (
    <div className="flex items-center gap-2">
      <time
        suppressHydrationWarning
        className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:block"
      >
        {now
          ? now.toLocaleTimeString("pt-BR", {
              hour12: false,
              timeZone: "America/Sao_Paulo",
            })
          : "--:--:--"}
      </time>
      <span className="hidden text-[11px] text-muted-foreground md:inline">
        auto 60s
      </span>
      <ThemeToggle />
      <Button
        variant="outline"
        size="sm"
        onClick={refresh}
        disabled={pending}
        aria-label="Atualizar dados do dashboard"
      >
        <RefreshCwIcon
          data-icon="inline-start"
          className={cn("size-3.5", pending && "animate-spin")}
        />
        Atualizar
      </Button>
    </div>
  );
}
