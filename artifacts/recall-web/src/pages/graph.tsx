import { useGetSavedArticles } from "@workspace/api-client-react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip } from "recharts";
import { Network } from "lucide-react";

export default function Graph() {
  const { data, isLoading } = useGetSavedArticles({ limit: 100 });

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--surface)]" />;
  }

  if (!data || data.articles.length === 0) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <Network className="mx-auto h-16 w-16 text-[var(--on-surface-muted)] opacity-30 mb-6" />
        <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "var(--app-font-display)" }}>Neural Matrix Empty</h2>
        <p className="text-[var(--on-surface-muted)]">Populate the archive to construct the knowledge graph.</p>
      </div>
    );
  }

  const graphData = data.articles.map(article => {
    const baseRadius = article.sourceType === "url" ? 50 : 20;
    const x = article.credibilityScore * 10 + (Math.random() * 20 - 10);
    const y = article.recallScore * 10 + (Math.random() * 20 - 10);
    
    return { x, y, z: baseRadius, name: article.title, type: article.sourceType, recall: article.recallScore };
  });

  return (
    <div className="absolute inset-0 bg-[var(--surface)] overflow-hidden flex flex-col">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--primary)] via-[var(--surface)] to-[var(--surface)]" />
      
      <div className="relative z-10 px-8 pt-8 pb-4 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3" style={{ fontFamily: "var(--app-font-display)" }}>
          <Network className="h-7 w-7 text-[var(--secondary)]" /> Matrix Topology
        </h1>
        <p className="text-[var(--on-surface-muted)] mt-1">Spatial visualization of node relationships.</p>
      </div>

      <div className="relative z-10 flex-1 w-full min-h-0 p-4 pb-8">
        <div className="w-full h-full glass rounded-2xl border border-[var(--outline-variant)] shadow-[0_0_48px_rgba(83,221,252,0.1)] p-2">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <XAxis type="number" dataKey="x" hide />
              <YAxis type="number" dataKey="y" hide />
              <ZAxis type="number" dataKey="z" range={[100, 800]} />
              <Tooltip 
                cursor={{ stroke: 'rgba(163, 166, 255, 0.2)', strokeDasharray: '3 3' }} 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="glass p-4 rounded-xl border border-[var(--primary)]/50 shadow-[0_0_24px_rgba(163,166,255,0.2)] max-w-[240px]">
                        <p className="font-bold text-sm mb-2 text-white leading-tight">{d.name}</p>
                        <div className="flex justify-between items-center text-xs">
                          <span className="label-caps text-[var(--secondary)]">{d.type}</span>
                          <span className="text-[var(--on-surface-muted)]">RCLL: {d.recall}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter name="Articles" data={graphData} fill="var(--secondary)" opacity={0.8} style={{ filter: 'drop-shadow(0 0 8px rgba(83,221,252,0.8))' }} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
