import type { ReactNode } from 'react';
import { brand } from '../../brand/brand.config';

/** A small browser window showing the app (its real header), for the story's scenes. */
export function AppWindow({ path, children }: { path: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-black/10">
      <div className="flex items-center gap-3 border-b border-black/5 bg-white px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-full bg-gray-100 px-3 py-1 text-center text-xs text-gray-500">
          ru-lost-found.vercel.app{path}
        </span>
      </div>
      <div className="header-solid flex h-11 items-center gap-2 px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-secondary-light bg-white p-1">
          <img src={brand.images.symbol} alt="" className="h-full w-full object-contain" />
        </span>
        <span className="font-display text-sm font-bold text-white">{brand.productName}</span>
        <span className="ml-auto hidden gap-1 text-xs text-white/90 sm:flex">
          <span className="rounded-full bg-white px-2.5 py-1 font-medium text-primary">Browse</span>
          <span className="px-2.5 py-1">My items</span>
          <span className="px-2.5 py-1">Claims</span>
        </span>
      </div>
      <div className="min-h-[25rem] p-4 sm:min-h-[26rem] sm:p-5">{children}</div>
    </div>
  );
}
