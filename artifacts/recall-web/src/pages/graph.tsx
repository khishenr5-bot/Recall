import { useGetSavedArticles } from "@workspace/api-client-react";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Network } from "lucide-react";

interface Article {
  id: number;
  title: string;
  verdict: string;
  recallScore: number;
  sourceType: string;
  bullets: string[];
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: number;
  title: string;
  recall: number;
  type: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  strength: number;
}

function getKeywords(text: string): Set<string> {
  const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "can", "how", "why", "what", "when", "where", "who", "which", "that", "this", "it", "its", "their", "they", "we", "you", "your", "not", "no", "more", "most", "about", "as", "into", "up", "also", "than"]);
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
  );
}

function computeLinks(articles: Article[]): GraphLink[] {
  const links: GraphLink[] = [];
  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      const a = articles[i];
      const b = articles[j];
      const aWords = getKeywords(`${a.title} ${a.verdict} ${a.bullets.join(" ")}`);
      const bWords = getKeywords(`${b.title} ${b.verdict} ${b.bullets.join(" ")}`);
      const intersection = new Set([...aWords].filter(w => bWords.has(w)));
      const union = new Set([...aWords, ...bWords]);
      const similarity = intersection.size / Math.max(union.size, 1);
      if (similarity > 0.04) {
        links.push({ source: a.id, target: b.id, strength: similarity });
      }
    }
  }
  return links;
}

function ForceGraph({ articles }: { articles: Article[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string } | null>(null);

  useEffect(() => {
    if (!svgRef.current || articles.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    const nodes: GraphNode[] = articles.map(a => ({
      id: a.id,
      title: a.title,
      recall: a.recallScore,
      type: a.sourceType,
    }));

    const links = computeLinks(articles);

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(120).strength(d => d.strength * 3))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(36));

    const g = svg.append("g");

    // Zoom/pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // Links
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "rgba(163, 166, 255, 0.25)")
      .attr("stroke-width", (d: GraphLink) => Math.max(1, d.strength * 6));

    // Color scale
    const colorScale = d3.scaleLinear<string>()
      .domain([0, 5, 10])
      .range(["#ff6b6b", "#53ddfc", "#50fa7b"]);

    // Nodes
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          }) as any
      );

    node.append("circle")
      .attr("r", (d: GraphNode) => 14 + d.recall * 1.5)
      .attr("fill", (d: GraphNode) => colorScale(d.recall))
      .attr("fill-opacity", 0.85)
      .attr("stroke", (d: GraphNode) => colorScale(d.recall))
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.5)
      .style("filter", (d: GraphNode) => `drop-shadow(0 0 8px ${colorScale(d.recall)}60)`);

    node.append("text")
      .text((d: GraphNode) => d.title.length > 20 ? d.title.slice(0, 18) + "…" : d.title)
      .attr("text-anchor", "middle")
      .attr("dy", (d: GraphNode) => 14 + d.recall * 1.5 + 16)
      .attr("font-size", "11px")
      .attr("fill", "var(--on-surface-muted)")
      .attr("pointer-events", "none");

    node.on("mouseenter", (event: MouseEvent, d: GraphNode) => {
      const rect = svgRef.current!.getBoundingClientRect();
      setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, title: d.title });
    }).on("mouseleave", () => setTooltip(null));

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: GraphNode) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => { simulation.stop(); };
  }, [articles]);

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 glass px-3 py-2 rounded-lg border border-[var(--primary)]/50 text-sm text-[var(--on-surface)] max-w-[240px] shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          {tooltip.title}
        </div>
      )}
    </div>
  );
}

export default function Graph() {
  const { data, isLoading } = useGetSavedArticles({ limit: 100 });

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
    </div>;
  }

  const articles = (data?.articles ?? []) as Article[];

  if (articles.length < 3) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <Network className="mx-auto h-16 w-16 text-[var(--on-surface-muted)] opacity-30 mb-6" />
        <h2 className="text-2xl font-bold text-[var(--on-surface)] mb-2" style={{ fontFamily: "var(--app-font-display)" }}>Knowledge Graph</h2>
        <p className="text-[var(--on-surface-muted)] max-w-sm mx-auto">Save at least 3 articles to see how your knowledge connects.</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-[var(--surface)] overflow-hidden flex flex-col">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--primary)] via-[var(--surface)] to-[var(--surface)]" />
      
      <div className="relative z-10 px-8 pt-8 pb-4 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--on-surface)] flex items-center gap-3" style={{ fontFamily: "var(--app-font-display)" }}>
          <Network className="h-7 w-7 text-[var(--secondary)]" /> Knowledge Graph
        </h1>
        <p className="text-[var(--on-surface-muted)] mt-1">See how your saved articles connect to each other. Drag nodes to explore. Scroll to zoom.</p>
      </div>

      <div className="relative z-10 flex-1 w-full min-h-0 px-4 pb-8">
        <div className="w-full h-full glass rounded-2xl border border-[var(--outline-variant)] shadow-[0_0_48px_rgba(83,221,252,0.1)] overflow-hidden">
          <ForceGraph articles={articles} />
        </div>
      </div>

      <div className="relative z-10 px-8 pb-4 flex items-center gap-6 text-xs text-[var(--on-surface-muted)]">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#50fa7b]" /> High recall score
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#53ddfc]" /> Medium recall score
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff6b6b]" /> Lower recall score
        </div>
        <div className="flex items-center gap-2">
          <span className="h-px w-6 bg-[rgba(163,166,255,0.4)]" /> Related articles
        </div>
      </div>
    </div>
  );
}
