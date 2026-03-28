/**
 * @file ExtensionDependencyGraph.tsx
 * @description D3 force-directed graph visualizing relationships between
 * extensions and the tools they provide.
 *
 * **Nodes** are colored by type:
 * - Extensions: sky-500 (blue, larger circles)
 * - Tools: emerald-500 (green, smaller circles)
 *
 * **Edges** represent "provides" relationships (extension -> tool).
 *
 * Supports zoom/pan via `d3.zoom()` on the SVG container and
 * hover-to-highlight interactions with a tooltip showing node details.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom as d3Zoom } from 'd3-zoom';
import type { ExtensionInfo, ExtensionToolInfo } from '@/lib/agentosClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphNode extends SimulationNodeDatum {
  /** Unique identifier for the node. */
  id: string;
  /** Display label shown next to the node. */
  label: string;
  /** Whether this node represents an extension or a tool. */
  type: 'extension' | 'tool';
  /** Extra metadata shown on hover. */
  description?: string;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  /** Source node id. */
  source: string | GraphNode;
  /** Target node id. */
  target: string | GraphNode;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExtensionDependencyGraphProps {
  /** Extension pack metadata from the registry. */
  extensions: ExtensionInfo[];
  /** Available tools derived from installed extensions. */
  tools: ExtensionToolInfo[];
}

// ---------------------------------------------------------------------------
// Color constants (Tailwind palette equivalents for SVG fills)
// ---------------------------------------------------------------------------

const COLOR_EXTENSION = '#0ea5e9'; // sky-500
const COLOR_TOOL = '#10b981'; // emerald-500
const COLOR_EDGE = '#334155'; // slate-700
const COLOR_EDGE_HIGHLIGHT = '#94a3b8'; // slate-400
const COLOR_LABEL = '#cbd5e1'; // slate-300
const COLOR_BG = '#0f172a'; // slate-900

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ExtensionDependencyGraph renders a force-directed graph of extension-to-tool
 * relationships. Each extension node connects to the tool nodes it provides.
 *
 * @param props - {@link ExtensionDependencyGraphProps}
 */
export const ExtensionDependencyGraph: React.FC<ExtensionDependencyGraphProps> = ({
  extensions,
  tools,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    type: string;
    description?: string;
  } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  /** Measure the container and update dimensions. */
  const measureContainer = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({
        width: Math.max(rect.width, 400),
        height: Math.max(rect.height, 300),
      });
    }
  }, []);

  useEffect(() => {
    measureContainer();
    const observer = new ResizeObserver(measureContainer);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [measureContainer]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;

    // ------------------------------------------------------------------
    // Build graph data
    // ------------------------------------------------------------------
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeIds = new Set<string>();

    for (const ext of extensions) {
      const extId = `ext:${ext.name}`;
      if (!nodeIds.has(extId)) {
        nodeIds.add(extId);
        nodes.push({
          id: extId,
          label: ext.name,
          type: 'extension',
          description: ext.description,
        });
      }

      // Link extension -> each tool it provides
      if (ext.tools) {
        for (const toolName of ext.tools) {
          const toolId = `tool:${toolName}`;
          if (!nodeIds.has(toolId)) {
            nodeIds.add(toolId);
            const toolInfo = tools.find((t) => t.name === toolName || t.id === toolName);
            nodes.push({
              id: toolId,
              label: toolName,
              type: 'tool',
              description: toolInfo?.description,
            });
          }
          links.push({ source: extId, target: toolId });
        }
      }
    }

    // Add orphan tools (tools not linked to any extension)
    for (const tool of tools) {
      const toolId = `tool:${tool.name}`;
      if (!nodeIds.has(toolId)) {
        nodeIds.add(toolId);
        nodes.push({
          id: toolId,
          label: tool.name,
          type: 'tool',
          description: tool.description,
        });

        // Try to link via the tool.extension field
        if (tool.extension) {
          const extId = `ext:${tool.extension}`;
          if (nodeIds.has(extId)) {
            links.push({ source: extId, target: toolId });
          }
        }
      }
    }

    if (nodes.length === 0) return;

    // ------------------------------------------------------------------
    // SVG container with zoom/pan
    // ------------------------------------------------------------------
    const g = svg.append('g');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svg as any).call(zoomBehavior);

    // ------------------------------------------------------------------
    // Force simulation
    // ------------------------------------------------------------------
    const simulation = forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(80)
      )
      .force('charge', forceManyBody().strength(-200))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide().radius(30));

    // ------------------------------------------------------------------
    // Render edges
    // ------------------------------------------------------------------
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', COLOR_EDGE)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6);

    // ------------------------------------------------------------------
    // Render nodes
    // ------------------------------------------------------------------
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer');

    // Extension nodes: larger circles
    node
      .filter((d) => d.type === 'extension')
      .append('circle')
      .attr('r', 12)
      .attr('fill', COLOR_EXTENSION)
      .attr('stroke', COLOR_EXTENSION)
      .attr('stroke-width', 2)
      .attr('fill-opacity', 0.3);

    // Tool nodes: smaller circles
    node
      .filter((d) => d.type === 'tool')
      .append('circle')
      .attr('r', 7)
      .attr('fill', COLOR_TOOL)
      .attr('stroke', COLOR_TOOL)
      .attr('stroke-width', 1.5)
      .attr('fill-opacity', 0.3);

    // Labels
    node
      .append('text')
      .text((d) => d.label)
      .attr('dx', (d) => (d.type === 'extension' ? 16 : 10))
      .attr('dy', 4)
      .attr('font-size', (d) => (d.type === 'extension' ? '11px' : '9px'))
      .attr('font-weight', (d) => (d.type === 'extension' ? '600' : '400'))
      .attr('fill', COLOR_LABEL)
      .attr('pointer-events', 'none');

    // ------------------------------------------------------------------
    // Hover interactions
    // ------------------------------------------------------------------
    node
      .on('mouseenter', (_event, d) => {
        // Highlight connected edges
        link
          .attr('stroke', (l) => {
            const sourceId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
            const targetId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
            return sourceId === d.id || targetId === d.id ? COLOR_EDGE_HIGHLIGHT : COLOR_EDGE;
          })
          .attr('stroke-width', (l) => {
            const sourceId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
            const targetId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
            return sourceId === d.id || targetId === d.id ? 2.5 : 1.5;
          });

        setTooltip({
          x: (d.x ?? 0) + 20,
          y: (d.y ?? 0) - 10,
          label: d.label,
          type: d.type,
          description: d.description,
        });
      })
      .on('mouseleave', () => {
        link.attr('stroke', COLOR_EDGE).attr('stroke-width', 1.5);
        setTooltip(null);
      });

    // ------------------------------------------------------------------
    // Tick handler
    // ------------------------------------------------------------------
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0);

      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [extensions, tools, dimensions]);

  return (
    <div ref={containerRef} className="relative w-full h-[500px] rounded-lg border theme-border overflow-hidden" style={{ background: COLOR_BG }}>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />

      {/* Legend */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 rounded-md border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: COLOR_EXTENSION, opacity: 0.7 }}
          />
          <span className="text-slate-300">Extension</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: COLOR_TOOL, opacity: 0.7 }}
          />
          <span className="text-slate-300">Tool</span>
        </div>
        <p className="mt-1 text-[9px] text-slate-500">Scroll to zoom, drag to pan</p>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-md border border-slate-600 bg-slate-800 px-3 py-2 shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="text-xs font-semibold text-slate-200">{tooltip.label}</p>
          <p className="text-[10px] text-slate-400 capitalize">{tooltip.type}</p>
          {tooltip.description && (
            <p className="mt-1 text-[10px] text-slate-400 line-clamp-3">{tooltip.description}</p>
          )}
        </div>
      )}
    </div>
  );
};
