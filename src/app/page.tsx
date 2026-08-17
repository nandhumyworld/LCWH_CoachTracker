const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "LifeChanging Wellness Hub";
const shortName = process.env.NEXT_PUBLIC_APP_SHORT_NAME ?? "LCWH";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold text-primary">{appName}</h1>
      <p className="text-muted-foreground">
        {shortName} MVP boilerplate is running. Auth, coach program builder,
        daily check-in, and AI reports are implemented per the plan in{" "}
        <code>docs/superpowers/plans/</code>.
      </p>
      <a
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        href="/api/health"
      >
        Health check
      </a>
    </main>
  );
}
