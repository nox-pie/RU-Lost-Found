import { collection, addDoc, query, orderBy, onSnapshot, updateDoc, doc, serverTimestamp, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Item } from '../types';

const ITEMS_COLLECTION = 'items';

// Default placeholder image for user-created items
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?w=800&auto=format&fit=crop';

export const createItem = async (item: Omit<Item, 'id' | 'createdAt' | 'status'>): Promise<string> => {
  const docRef = await addDoc(collection(db, ITEMS_COLLECTION), {
    ...item,
    status: 'open',
    createdAt: serverTimestamp(),
    image: item.image || DEFAULT_IMAGE
  });
  return docRef.id;
};

export const subscribeToItems = (onItemsUpdate: (items: Item[]) => void) => {
  const q = query(collection(db, ITEMS_COLLECTION), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const items: Item[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const timestamp = data.createdAt as Timestamp;
      items.push({
        ...data,
        id: doc.id,
        createdAt: timestamp?.toMillis() || Date.now(), // Fallback if timestamp is null
        image: data.image || DEFAULT_IMAGE
      } as Item);
    });
    onItemsUpdate(items);
  }, (error) => {
    console.error('Error fetching items:', error);
  });
};

export const updateItemStatus = async (itemId: string, status: 'open' | 'claimed', claimerInfo?: { name: string; contact: string; details: string }) => {
  try {
    const itemRef = doc(db, ITEMS_COLLECTION, itemId);
    await updateDoc(itemRef, { 
      status,
      updatedAt: serverTimestamp(),
      ...(claimerInfo && { claimedBy: claimerInfo }) // Only add claimedBy if claimerInfo is provided
    });
  } catch (error) {
    console.error('Error updating item status:', error);
    throw error;
  }
};

export const deleteItem = async (itemId: string) => {
  try {
    const itemRef = doc(db, ITEMS_COLLECTION, itemId);
    await deleteDoc(itemRef);
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
};