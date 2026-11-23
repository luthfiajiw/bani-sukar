'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { BranchFilter } from '@/components/tree/branch-filter';
import { PersonNode } from '@/components/tree/person-node';
import { UnionNode } from '@/components/tree/union-node';
import { Button } from '@/components/ui/button';
import { H, W } from '@/features/family/layout';
import type {
  PersonNodeData,
  TreeLayoutResult,
  TreeOrientation,
  UnionNodeData,
} from '@/features/family/types';

type AppNode = Node<PersonNodeData, 'person'> | Node<UnionNodeData, 'union'>;

const nodeTypes = {
  person: PersonNode,
  union: UnionNode,
} as const;

interface FamilyCanvasProps {
  layout: TreeLayoutResult;
  selectedBranchId: string | null;
  orientation: TreeOrientation;
  initialFocusId: string | null;
}

function FamilyCanvasInner({
  layout,
  selectedBranchId,
  orientation,
  initialFocusId,
}: FamilyCanvasProps) {
  const router = useRouter();
  const { setCenter, zoomIn, zoomOut, fitView } = useReactFlow();
  const [highlightedId, setHighlightedId] = React.useState<string | null>(null);
  const highlightTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const prevViewKeyRef = React.useRef<string>(
    `${selectedBranchId ?? ''}:${orientation}`,
  );

  const focusNode = React.useCallback(
    (personId: string) => {
      const targetNode = layout.nodes.find(
        (n) => n.type === 'person' && n.id === personId,
      );
      if (!targetNode) {
        return false;
      }

      setCenter(targetNode.position.x + W / 2, targetNode.position.y + H / 2, {
        zoom: 1.15,
        duration: 500,
      });

      setHighlightedId(personId);
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedId(null);
      }, 3000);

      return true;
    },
    [layout.nodes, setCenter],
  );

  React.useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!initialFocusId) return;
    const timer = setTimeout(() => {
      focusNode(initialFocusId);
    }, 80);
    return () => clearTimeout(timer);
  }, [initialFocusId, focusNode]);

  React.useEffect(() => {
    const nextKey = `${selectedBranchId ?? ''}:${orientation}`;
    if (prevViewKeyRef.current !== nextKey) {
      prevViewKeyRef.current = nextKey;
      if (!initialFocusId) {
        const timer = setTimeout(() => {
          fitView({ padding: 0.18, duration: 400 });
        }, 60);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedBranchId, orientation, initialFocusId, fitView]);

  const handleSelectPerson = React.useCallback(
    (personId: string) => {
      const found = focusNode(personId);
      if (!found) {
        const params = new URLSearchParams();
        if (orientation === 'LEFT_RIGHT') {
          params.set('arah', 'LEFT_RIGHT');
        }
        params.set('fokus', personId);
        router.replace(`/?${params.toString()}`, {
          scroll: false,
        });
      }
    },
    [focusNode, orientation, router],
  );

  const handleFitView = React.useCallback(() => {
    fitView({ padding: 0.18, duration: 400 });
  }, [fitView]);

  const nodes: AppNode[] = React.useMemo(
    () =>
      layout.nodes.map((n) => {
        if (n.type === 'person') {
          const data = n.data as PersonNodeData;
          return {
            id: n.id,
            type: 'person',
            position: n.position,
            data: {
              ...data,
              isHighlighted: n.id === highlightedId,
            },
          };
        }
        return {
          id: n.id,
          type: 'union',
          position: n.position,
          data: n.data as UnionNodeData,
          selectable: false,
        };
      }),
    [layout.nodes, highlightedId],
  );

  const edges: Edge[] = React.useMemo(
    () =>
      layout.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
        type: e.type ?? 'default',
        animated: e.animated ?? false,
        selectable: false,
        style: {
          stroke: '#8c756b',
          strokeWidth: 1.75,
          ...(e.style as React.CSSProperties | undefined),
        },
        data: e.data,
      })),
    [layout.edges],
  );

  const handleNodeClick = React.useCallback(
    (_event: React.MouseEvent, node: AppNode) => {
      if (node.type === 'person') {
        router.push(`/anggota/${node.id}`);
      }
    },
    [router],
  );

  return (
    <div className="flex flex-col">
      <BranchFilter
        branches={layout.branches}
        selectedBranchId={selectedBranchId}
        orientation={orientation}
        persons={layout.persons}
        onSelectPerson={handleSelectPerson}
        onFitView={handleFitView}
      />

      <div className="relative h-[calc(100dvh-120px)] min-h-[500px] w-full bg-background">
        <ReactFlow<AppNode, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          panOnScroll
          zoomOnPinch
          minZoom={0.15}
          maxZoom={1.8}
          style={{ backgroundColor: 'var(--background)' }}
          attributionPosition="top-right"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.5}
            color="#d4c3bc"
            bgColor="var(--background)"
          />

          {/* Bottom-left zoom controls */}
          <Panel position="bottom-left" className="!m-3 sm:!m-4">
            <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card/95 shadow-sm backdrop-blur-xs">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => zoomIn({ duration: 250 })}
                aria-label="Perbesar bagan"
                title="Perbesar (+)"
                className="rounded-none border-b border-border"
              >
                <Plus className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => zoomOut({ duration: 250 })}
                aria-label="Perkecil bagan"
                title="Perkecil (-)"
                className="rounded-none border-b border-border"
              >
                <Minus className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleFitView}
                aria-label="Sesuaikan tampilan bagan"
                title="Pas di layar"
                className="rounded-none"
              >
                <Maximize2 className="size-3.5" />
              </Button>
            </div>
          </Panel>

          {/* Bottom-center floating legend pill */}
          <Panel
            position="bottom-center"
            className="!m-3 hidden md:block sm:!m-4"
          >
            <div className="flex flex-wrap items-center gap-3 rounded-full border border-border bg-card/95 px-4 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-xs">
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <span className="inline-block h-2.5 w-4 rounded-xs border border-[#d4c3bc] bg-card" />
                Garis Keturunan (Nasab)
              </span>
              <span className="text-border">|</span>
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <span className="font-extrabold text-destructive">{'//'}</span>
                Ikatan Pernikahan
              </span>
              <span className="text-border">|</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#2d4030]" />
                Masih Hidup
              </span>
              <span className="text-border">|</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-destructive" />
                Almarhum / Wafat
              </span>
            </div>
          </Panel>

          {/* MiniMap card */}
          <Panel
            position="bottom-right"
            className="!m-3 hidden sm:block sm:!m-4"
          >
            <div className="overflow-hidden rounded-xl border border-border bg-card/95 shadow-sm backdrop-blur-xs">
              <div className="flex items-center justify-between border-b border-border bg-muted/60 px-2.5 py-1">
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  MINIMAP FLOW
                </span>
                <span className="size-1.5 rounded-full bg-accent" />
              </div>
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) => {
                  if (node.type === 'union') return '#c49753';
                  const data = node.data as PersonNodeData | undefined;
                  if (data?.person?.isBloodLine === false) return '#e6dfd3';
                  return '#5c3d2e';
                }}
                maskColor="rgba(253, 249, 241, 0.7)"
                style={{
                  position: 'relative',
                  margin: 0,
                  width: 168,
                  height: 108,
                  backgroundColor: '#fdf9f1',
                }}
              />
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

export function FamilyCanvas(props: FamilyCanvasProps) {
  return (
    <ReactFlowProvider>
      <FamilyCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
