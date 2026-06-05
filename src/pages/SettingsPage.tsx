export function SettingsPage() {
  const endpoints = [
    {
      method: "POST",
      path: "/upload",
      payload: "{ fileName, jurisdiction, documentType, sourceLabel?, notes? }",
    },
    {
      method: "POST",
      path: "/analyze",
      payload: "{ uploadId, focusAreas[], audience }",
    },
    {
      method: "GET",
      path: "/results",
      payload: "Returns analysis result list",
    },
    {
      method: "GET",
      path: "/status",
      payload: "Returns upload queue and dashboard metrics",
    },
    {
      method: "GET",
      path: "/alerts",
      payload: "Returns notification items",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Integration</div>
        <h2 className="mt-1 text-2xl font-semibold text-white">API endpoints</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Backend endpoints the frontend integrates with. Keep payloads minimal and stable for production.
        </p>
      </div>

      <section className="rounded-3xl border border-white/8 bg-white/5 p-5">
        <div className="space-y-3">
          {endpoints.map((endpoint) => (
            <div key={endpoint.path} className="rounded-2xl border border-white/8 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-200">
                  {endpoint.method}
                </span>
                <div className="font-mono text-sm text-white">{endpoint.path}</div>
              </div>
              <div className="mt-2 text-sm text-slate-400">Expected payload: {endpoint.payload}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
