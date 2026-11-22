import { Mars, Venus } from 'lucide-react';
import type { Gender } from '@/features/family/types';
import { cn } from '@/lib/utils';

const GENDER_BADGE_SIZES = {
  xs: {
    wrapper: 'rounded px-1 py-0.5',
    icon: 'size-3',
  },
  sm: {
    wrapper: 'rounded-md px-1.5 py-0.5',
    icon: 'size-3.5',
  },
  md: {
    wrapper: 'rounded-md px-2 py-1',
    icon: 'size-4',
  },
} as const;

export function getGenderLabel(gender: Gender): string {
  return gender === 'L' ? 'Laki-laki' : 'Perempuan';
}

export function GenderIcon({
  gender,
  className,
}: {
  gender: Gender;
  className?: string;
}) {
  const Icon = gender === 'L' ? Mars : Venus;
  return (
    <Icon
      aria-hidden="true"
      className={cn(
        'size-3.5 shrink-0',
        gender === 'L' ? 'text-primary' : 'text-[#7a541a]',
        className,
      )}
    />
  );
}

export function GenderBadge({
  gender,
  size = 'sm',
  className,
}: {
  gender: Gender;
  size?: keyof typeof GENDER_BADGE_SIZES;
  className?: string;
}) {
  const label = getGenderLabel(gender);
  const styles = GENDER_BADGE_SIZES[size];

  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold',
        gender === 'L'
          ? 'bg-primary/10 text-primary'
          : 'bg-accent/20 text-[#7a541a]',
        styles.wrapper,
        className,
      )}
    >
      <GenderIcon gender={gender} className={styles.icon} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
