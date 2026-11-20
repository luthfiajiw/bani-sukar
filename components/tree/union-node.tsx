'use client';

import * as React from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Heart } from 'lucide-react';
import type { UnionNodeData } from '@/features/family/types';
import { cn } from '@/lib/utils';

type UnionFlowNode = Node<UnionNodeData, 'union'>;

const hiddenHandleClass =
  '!size-2 !min-h-0 !min-w-0 !border-0 !bg-transparent opacity-0 pointer-events-none';

function UnionNodeComponent({ data }: NodeProps<UnionFlowNode>) {
  const { union, husbandName, wifeName } = data;
  const isDivorced = union.status === 'divorced';
  const isWidowed = union.status === 'widowed';

  const statusLabel = isDivorced
    ? 'Bercerai'
    : isWidowed
      ? 'Cerai Mati'
      : 'Menikah';

  const title = [husbandName, wifeName].filter(Boolean).join(' & ')
    ? `${[husbandName, wifeName].filter(Boolean).join(' & ')} (${statusLabel})`
    : statusLabel;

  return (
    <div
      title={title}
      aria-label={title}
      className={cn(
        'relative flex size-7 items-center justify-center rounded-full border shadow-xs transition-colors',
        isDivorced
          ? 'border-destructive/40 bg-card text-destructive'
          : isWidowed
            ? 'border-[#d4c3bc] bg-secondary text-primary'
            : 'border-accent/60 bg-[#fdf9f1] text-primary',
      )}
    >
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className={hiddenHandleClass}
      />
      <Handle
        id="right"
        type="target"
        position={Position.Right}
        className={hiddenHandleClass}
      />
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className={hiddenHandleClass}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className={hiddenHandleClass}
      />

      {isDivorced ? (
        <span className="text-[11px] font-extrabold leading-none tracking-tighter text-destructive">
          {'//'}
        </span>
      ) : (
        <Heart
          className={cn(
            'size-3.5',
            isWidowed
              ? 'fill-primary/25 text-primary'
              : 'fill-accent text-primary',
          )}
        />
      )}
    </div>
  );
}

export const UnionNode = React.memo(UnionNodeComponent);
