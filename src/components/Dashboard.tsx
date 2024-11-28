import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import ItemCard from './ItemCard';
import ReportForm from './ReportForm';
import ClaimModal from './ClaimModal';
import Footer from './Footer';
import { Item } from '../types';
import { subscribeToItems, updateItemStatus, deleteItem } from '../services/itemService';
import { dummyCards } from '../data/dummyCards';

export default function Dashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'lost' | 'found' | 'claimed'>('all');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  
  const ITEMS_PER_PAGE = 9;

  const dummyItems: Item[] = dummyCards.map((card, index) => ({
    ...card,
    id: `dummy-${index + 1}`
  }));

  useEffect(() => {
    const unsubscribe = subscribeToItems((updatedItems) => {
      const allItems = [...dummyItems, ...updatedItems];
      setItems(allItems);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const handleClaimItem = async (itemId: string, claimerInfo: { name: string; contact: string; details: string }) => {
    try {
      if (itemId.startsWith('dummy-')) {
        alert('Demo items cannot be claimed.');
        setSelectedItem(null);
        return;
      }

      await updateItemStatus(itemId, 'claimed', claimerInfo);
      setSelectedItem(null);
      alert('Claim submitted successfully! The reporter will be notified.');
    } catch (error: any) {
      console.error('Error claiming item:', error);
      if (error.code === 'permission-denied') {
        alert('You do not have permission to claim this item.');
      } else {
        alert('Failed to submit claim. Please try again.');
      }
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (itemId.startsWith('dummy-')) {
      alert('Demo items cannot be deleted.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteItem(itemId);
        alert('Item deleted successfully!');
      } catch (error: any) {
        console.error('Error deleting item:', error);
        if (error.code === 'permission-denied') {
          alert('You do not have permission to delete this item.');
        } else {
          alert('Failed to delete item. Please try again.');
        }
      }
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.location.toLowerCase().includes(searchQuery.toLowerCase());

    switch (filter) {
      case 'lost':
        return item.type === 'lost' && item.status === 'open' && matchesSearch;
      case 'found':
        return item.type === 'found' && item.status === 'open' && matchesSearch;
      case 'claimed':
        return item.status === 'claimed' && matchesSearch;
      default:
        return matchesSearch;
    }
  });

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-[#fcf1e8] flex flex-col">
      <Header 
        onReportClick={() => setShowReportForm(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Lost Something? Found Something?
          </h2>
          <p className="text-base sm:text-lg text-gray-600 mb-8">
            Connect lost items with their owners in the Rishihood University community
          </p>
          <button
            onClick={() => setShowReportForm(true)}
            className="bg-primary hover:bg-primary-light text-white px-6 sm:px-8 py-2 sm:py-3 rounded-full text-base sm:text-lg font-medium transition duration-300"
          >
            Report an Item
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-8">
          {['all', 'lost', 'found', 'claimed'].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f as typeof filter);
                setCurrentPage(1);
              }}
              className={`px-4 sm:px-6 py-2 rounded-full text-sm sm:text-base ${
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              } transition duration-300`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg sm:text-xl">No items found</p>
            <p className="mt-2 text-sm sm:text-base">
              {filter === 'claimed' 
                ? 'No items have been claimed yet.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
            {paginatedItems.map((item) => (
              <ItemCard 
                key={item.id} 
                {...item} 
                onAction={() => setSelectedItem(item)}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 sm:px-4 py-1 sm:py-2 rounded-md text-sm ${
                  currentPage === page
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                } transition duration-300`}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </main>

      <Footer />

      {showReportForm && (
        <ReportForm 
          onClose={() => setShowReportForm(false)}
          currentUser={currentUser}
        />
      )}

      {selectedItem && (
        <ClaimModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSubmit={(claimerInfo) => handleClaimItem(selectedItem.id, claimerInfo)}
        />
      )}
    </div>
  );
}