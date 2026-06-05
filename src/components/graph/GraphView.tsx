const jurisdictions = [
  { code: "SG", name: "Singapore", framework: "MAS / AGC", status: "Active", coverage: "Full", updates: 3 },
  { code: "MY", name: "Malaysia", framework: "SC / BNM", status: "Active", coverage: "Full", updates: 1 },
  { code: "ID", name: "Indonesia", framework: "OJK / BI", status: "Monitoring", coverage: "Partial", updates: 5 },
  { code: "TH", name: "Thailand", framework: "SEC / BOT", status: "Active", coverage: "Full", updates: 2 },
  { code: "PH", name: "Philippines", framework: "SEC / BSP", status: "Monitoring", coverage: "Partial", updates: 4 },
  { code: "VN", name: "Vietnam", framework: "SSC / SBV", status: "Review", coverage: "Limited", updates: 7 },
];

const relationships = [
  { from: "SG", to: "MY", type: "MRA", description: "Mutual Recognition Agreement" },
  { from: "SG", to: "ID", type: "MOC", description: "Memorandum of Cooperation" },
  { from: "MY", to: "TH", type: "MOC", description: "Memorandum of Cooperation" },
  { from: "SG", to: "PH", type: "MOU", description: "Memorandum of Understanding" },
];

const statusColors: Record<string, string> = {
  Active: "bg-green-50 text-green-700 border-green-200",
  Monitoring: "bg-amber-50 text-amber-700 border-amber-200",
  Review: "bg-red-50 text-red-700 border-red-200",
};

const coverageColors: Record<string, string> = {
  Full: "text-green-600",
  Partial: "text-amber-600",
  Limited: "text-red-600",
};

export function GraphView() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Regulatory Intelligence</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">ASEAN Jurisdiction Coverage</h2>
            <p className="mt-1 text-sm text-slate-500">
              Monitored regulatory frameworks and cross-border agreements across Southeast Asia.
            </p>
          </div>
          <span className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
            {jurisdictions.length} jurisdictions tracked
          </span>
        </div>
      </div>

      {/* Jurisdiction table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Jurisdiction</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Regulatory Body</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Coverage</th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Recent Updates</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {jurisdictions.map((j) => (
              <tr key={j.code} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded bg-blue-800 text-[10px] font-bold text-white">
                      {j.code}
                    </span>
                    <span className="font-medium text-slate-800">{j.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-slate-500">{j.framework}</td>
                <td className="px-5 py-3">
                  <span className={`rounded border px-2 py-0.5 text-xs font-medium ${statusColors[j.status]}`}>
                    {j.status}
                  </span>
                </td>
                <td className={`px-5 py-3 text-xs font-semibold ${coverageColors[j.coverage]}`}>{j.coverage}</td>
                <td className="px-5 py-3 text-right">
                  <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                    j.updates > 4 ? "bg-red-100 text-red-700" : j.updates > 2 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {j.updates}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cross-border agreements */}
      <div className="border-t border-slate-100 px-5 py-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Cross-Border Agreements</div>
        <div className="flex flex-wrap gap-2">
          {relationships.map((r) => (
            <div
              key={`${r.from}-${r.to}`}
              className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
            >
              <span className="font-semibold text-blue-800">{r.from}</span>
              <span className="text-slate-300">↔</span>
              <span className="font-semibold text-blue-800">{r.to}</span>
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">{r.type}</span>
              <span className="text-slate-500">{r.description}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
