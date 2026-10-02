import { ActivityIcon } from "lucide-react";
import { cn } from "cn";
import { getMarketStatus } from "@/lib/server/market";
import { TopBarActions } from "./top-bar-actions";

export function TopBar() {
  const status = getMarketStatus();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-3 px-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ActivityIcon className="size-4" aria-hidden />
          </span>
          <div className="leading-tight">
            <h1 className="font-heading text-sm font-semibold">Mercado B3</h1>
            <p className="text-[11px] text-muted-foreground">
              POC · Backend-for-Frontend
            </p>
          </div>
        </div>

        <span
          title={status.hint}
          className="ml-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
        >
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              status.open ? "bg-emerald-500" : "bg-muted-foreground/50",
            )}
          />
          {status.label}
          <span className="sr-only">— {status.hint}</span>
        </span>

        <div className="ml-auto">
          <TopBarActions />
        </div>
      </div>
    </header>
  );
}
