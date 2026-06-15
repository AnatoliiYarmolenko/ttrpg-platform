import React from 'react';
import PropTypes from 'prop-types';

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-brand-light/20 rounded ${className}`} />;
}

Skeleton.propTypes = {
  className: PropTypes.string,
};

export function SkeletonSessionCard() {
  return (
    <div className="p-4 border-2 border-brand-light/10 rounded-xl space-y-2">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-14 shrink-0" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}

export function SkeletonCampaignCard() {
  return (
    <div className="p-4 border-2 border-brand-light/10 rounded-xl space-y-2">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-16 shrink-0" />
      </div>
      <Skeleton className="h-4 w-full" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-14" />
      </div>
    </div>
  );
}

export function SkeletonSessionDetail() {
  return (
    <div data-testid="skeleton-session-detail" className="flex flex-col gap-4 h-full">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-6 w-20 shrink-0" />
        </div>
        <Skeleton className="h-4 w-1/2" />
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 bg-brand-light/10 rounded-xl">
        {['field-1', 'field-2', 'field-3', 'field-4', 'field-5', 'field-6'].map((field) => (
          <Skeleton key={field} className="h-4 w-full" />
        ))}
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>

      <Skeleton className="mt-auto h-10 w-full rounded-lg" />
    </div>
  );
}

export function SkeletonProfile() {
  return (
    <div className="space-y-4 py-8">
      <div className="flex justify-center">
        <Skeleton className="w-24 h-24 rounded-full" />
      </div>
      <Skeleton className="h-6 w-1/2 mx-auto" />
      <Skeleton className="h-4 w-2/3 mx-auto" />
    </div>
  );
}

export function SkeletonNotification() {
  return (
    <div className="rounded-xl border border-brand-light/10 p-4 space-y-2">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between gap-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-12 shrink-0" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonForm({ rows = 3 }) {
  const rowKeys = Array.from({ length: rows }, (_, index) => `row-${index + 1}`);

  return (
    <div className="space-y-6 py-4">
      {rowKeys.map((rowKey) => (
        <div key={rowKey} className="space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-10 w-1/3 rounded-lg mt-4" />
    </div>
  );
}

SkeletonForm.propTypes = {
  rows: PropTypes.number,
};
