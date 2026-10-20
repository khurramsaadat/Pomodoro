import { AppShell } from '@/components/layout/app-shell';

export default function App() {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pomodoro</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          The application shell is ready. The timer engine arrives in Phase 3.
        </p>
      </div>
    </AppShell>
  );
}
