import React from 'react';
import { DietaryType } from '@/lib/types';

interface DietaryBadgeProps {
  type: DietaryType;
  size?: 'sm' | 'md';
}

export function DietaryBadge({ type, size = 'sm' }: DietaryBadgeProps) {
  const isVeg = type === 'veg';
  const boxDim = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const dotDim = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span
      className={`inline-flex items-center justify-center ${boxDim} border ${
        isVeg ? 'border-veg' : 'border-nonveg'
      } bg-white rounded-none shrink-0`}
      title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
      aria-label={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
    >
      <span
        className={`${dotDim} rounded-full ${
          isVeg ? 'bg-veg' : 'bg-nonveg'
        }`}
      />
    </span>
  );
}
