import { ITEM_CATEGORIES, type ItemCategory } from '@ru-lost-found/shared';
import {
  Backpack,
  BookOpen,
  Glasses,
  IdCard,
  KeyRound,
  Milk,
  Package,
  Shirt,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { DropdownOption } from '../components/ui/Dropdown';
import { CATEGORY_LABELS } from './format';

/** One icon per item category, for dropdowns and labels. */
export const CATEGORY_ICONS: Record<ItemCategory, LucideIcon> = {
  ELECTRONICS: Smartphone,
  ID_CARD: IdCard,
  KEYS: KeyRound,
  WALLET: Wallet,
  BAG: Backpack,
  CLOTHING: Shirt,
  BOOKS: BookOpen,
  BOTTLE: Milk,
  ACCESSORIES: Glasses,
  OTHER: Package,
};

export const CATEGORY_OPTIONS: DropdownOption<ItemCategory>[] = ITEM_CATEGORIES.map((category) => ({
  value: category,
  label: CATEGORY_LABELS[category],
  icon: CATEGORY_ICONS[category],
}));
