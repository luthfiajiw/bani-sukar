'use client';

import * as React from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { PersonAvatar } from '@/components/person-avatar';
import type { PersonNodeData } from '@/features/family/types';
import { formatYearRange } from '@/lib/format';
import { cn } from '@/lib/utils';

type PersonFlowNode = Node<PersonNodeData, 'person'>;

const hiddenHandleClass =
  '!size-2 !min-h-0 !min-w-0 !border-0 !bg-transparent opacity-0 pointer-events-none';

function PersonNodeComponent({ data, selected }: NodeProps<PersonFlowNode>) {
  const { person, generation, isHighlighted } = data;
  const years = formatYearRange(
    person.birthDate,
    person.deathDate,
    person.isDeceased,
  );

  return (
    <div
      className={cn(
        'group relative w-[200px] min-h-[84px] cursor-pointer rounded-xl px-2.5 py-2 text-left transition-all duration-200',
        person.isBloodLine
          ? 'border border-[#d4c3bc] bg-card shadow-xs hover:border-primary hover:shadow-sm'
          : 'border border-dashed border-[#d4c3bc] bg-[#f7f3eb] shadow-xs hover:border-primary hover:shadow-sm',
        selected && 'border-primary ring-2 ring-primary/30',
        isHighlighted &&
          'border-accent ring-2 ring-accent ring-offset-2 ring-offset-background shadow-md animate-pulse',
      )}
    >
      {/* Hidden attachment handles */}
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
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className={hiddenHandleClass}
      />
      <Handle
        id="left-target"
        type="target"
        position={Position.Left}
        className={hiddenHandleClass}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className={hiddenHandleClass}
      />
      <Handle
        id="right-target"
        type="target"
        position={Position.Right}
        className={hiddenHandleClass}
      />

      <div className="flex items-start gap-2">
        <PersonAvatar
          fullName={person.fullName}
          gender={person.gender}
          isDeceased={person.isDeceased}
          size="sm"
          className="mt-0.5 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <p className="line-clamp-2 text-[12px] font-semibold leading-tight text-foreground group-hover:text-primary">
              {person.fullName}
            </p>
          </div>
          {person.nickname && (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
              &ldquo;{person.nickname}&rdquo;
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1.5 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'inline-flex items-center rounded px-1 py-px font-semibold',
              person.gender === 'L'
                ? 'bg-primary/10 text-primary'
                : 'bg-accent/20 text-accent-foreground',
            )}
          >
            {person.gender}
          </span>
          <span className="rounded bg-secondary px-1 py-px font-medium text-secondary-foreground">
            G{generation}
          </span>
          <span
            className={cn(
              'inline-block size-1.5 rounded-full',
              person.isDeceased ? 'bg-destructive' : 'bg-[#2d4030]',
            )}
            title={person.isDeceased ? 'Almarhum / Wafat' : 'Masih Hidup'}
          />
        </div>

        <span className="truncate text-right font-medium text-foreground/80">
          {person.birthPlace ? `${person.birthPlace} • ` : ''}
          {years}
        </span>
      </div>
    </div>
  );
}

export const PersonNode = React.memo(PersonNodeComponent);
