import type { ItemDto } from '@ru-lost-found/shared';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { brand } from '../../brand/brand.config';

/**
 * Shares a post: the phone's share sheet (WhatsApp, a class group…) where there is one,
 * otherwise the link is copied. Viewers need to sign in, and are brought back to the post.
 */
export function ShareButton({ item }: { item: ItemDto }) {
  const url = `${window.location.origin}/items/${item.id}`;
  const text = `${item.type === 'LOST' ? 'Lost' : 'Found'}: ${item.title} (${item.location}). Seen it? ${brand.productName}`;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, text, url });
      } catch {
        // Closing the share sheet is not an error worth showing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied. Paste it wherever you like.');
    } catch {
      toast.error('Could not copy the link. Copy it from the address bar instead.');
    }
  };

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Share2 className="h-4 w-4" aria-hidden /> Share
    </button>
  );
}
