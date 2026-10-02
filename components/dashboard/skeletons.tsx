import { Card, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function Row({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-5 w-5 rounded-md" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="ml-auto h-4 w-16" />
      <Skeleton className="h-4 w-12" />
      {cols > 4 ? <Skeleton className="hidden h-4 w-16 sm:block" /> : null}
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-4 w-24" />
          </CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3 px-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Row key={i} />
          ))}
        </div>
      </Card>
      <Card className="gap-4">
        <div className="flex items-center gap-3 px-4">
          <Skeleton className="size-9 rounded-md" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="ml-auto h-8 w-32" />
        </div>
        <Skeleton className="mx-4 h-[300px] w-[calc(100%-2rem)] rounded-lg" />
      </Card>
    </div>
  );
}

export function ScreenerSkeleton() {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardAction>
          <Skeleton className="h-7 w-56" />
        </CardAction>
        <CardTitle>
          <Skeleton className="h-4 w-32" />
        </CardTitle>
      </CardHeader>
      <div className="flex flex-col gap-3 px-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Row key={i} cols={6} />
        ))}
      </div>
    </Card>
  );
}

export function MacroSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-4 w-44" />
          </CardTitle>
        </CardHeader>
        <Skeleton className="mx-4 h-[260px] w-[calc(100%-2rem)] rounded-lg" />
      </Card>
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-4 w-32" />
          </CardTitle>
        </CardHeader>
        <Skeleton className="mx-4 h-[260px] w-[calc(100%-2rem)] rounded-lg" />
      </Card>
    </div>
  );
}
