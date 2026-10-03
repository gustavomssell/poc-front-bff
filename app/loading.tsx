import { MacroSkeleton, OverviewSkeleton, ScreenerSkeleton } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 md:px-6">
      <OverviewSkeleton />
      <ScreenerSkeleton />
      <MacroSkeleton />
    </main>
  );
}
