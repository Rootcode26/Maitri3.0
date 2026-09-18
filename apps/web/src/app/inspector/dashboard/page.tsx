export default function InspectorDashboardPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-slate-500">Inspector workspace</p>
      <h1 className="mt-1 text-4xl font-bold tracking-tight text-[#142b45] sm:text-5xl">
        Inspector dashboard
      </h1>
      <p className="mt-3 max-w-xl text-base text-slate-600">
        You are signed in. Assigned applications and review queues will appear here.
      </p>
    </main>
  );
}
