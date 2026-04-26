import { Item } from '../types';

const getToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

export const fetchItems = async (): Promise<Item[]> => {
  const res = await fetch('/api/items', { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch items');
  const items = await res.json();
  return items.map((item: any) => ({
    ...item,
    id: item._id,
    reporterId: item.reporterId?._id || item.reporterId,
    reporter: item.reporterId ? `${item.reporterId.firstName} ${item.reporterId.lastName}` : item.reporter,
    createdAt: new Date(item.createdAt).getTime()
  }));
};

export const createItem = async (formData: FormData): Promise<Item> => {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // Let the browser set Content-Type to multipart/form-data with boundary

  const res = await fetch('/api/items', {
    method: 'POST',
    headers,
    body: formData
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create item');
  return data._id;
};

export const updateItemStatus = async (itemId: string, status: 'open' | 'claimed', claimerInfo?: { name: string; contact: string; details: string }) => {
  const res = await fetch(`/api/items/${itemId}/status`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ status, claimedBy: claimerInfo })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Failed to update item');
  }
};

export const deleteItem = async (itemId: string) => {
  const res = await fetch(`/api/items/${itemId}`, {
    method: 'DELETE',
    headers: headers()
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Failed to delete item');
  }
};

export const contactReporter = async (itemId: string, details: string, sharePhone: boolean): Promise<void> => {
  const res = await fetch(`/api/contact/${itemId}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ details, sharePhone })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Failed to contact reporter');
  }
};