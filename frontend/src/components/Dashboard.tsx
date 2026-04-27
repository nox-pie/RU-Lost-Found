import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import ItemCard from './ItemCard';
import ReportForm from './ReportForm';
import ClaimModal from './ClaimModal';
import Footer from './Footer';
import { Item } from '../types';
import { fetchItems, updateItemStatus, deleteItem, contactReporter } from '../services/itemService';
import { dummyCards } from '../data/dummyCards';
import { Plus } from 'lucide-react';

export default function Dashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showReportForm, setShowReportForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'lost' | 'found' | 'claimed'>('all');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const gridRef = useRef<HTMLDivElement>(null);
  
  const ITEMS_PER_PAGE = 9;

  const dummyItems: Item[] = dummyCards.map((card, index) => ({
    ...card,
    id: `dummy-${index + 1}`
  }));

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    const elements = document.querySelectorAll('.scroll-animate');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [items, currentPage, filter, searchQuery]);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setIsLoading(true);
      const updatedItems = await fetchItems();
      const allItems = [...dummyItems, ...updatedItems];
      setItems(allItems);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const handleClaimItem = async (itemId: string, claimerInfo: { details: string; sharePhone: boolean }) => {
    try {
      if (itemId.startsWith('dummy-')) {
        alert('Demo items cannot be claimed.');
        setSelectedItem(null);
        return;
      }

      await contactReporter(itemId, claimerInfo.details, claimerInfo.sharePhone);
      setSelectedItem(null);
      alert('Claim submitted successfully! The reporter has been notified via email.');
      loadItems();
    } catch (error: any) {
      console.error('Error claiming item:', error);
      alert('Failed to submit claim. Please try again.');
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
        loadItems();
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
        onSearchChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
      />
      
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16 scroll-animate">
          <h2 className="text-3xl sm:text-5xl font-bold text-gray-900 mb-5 font-display leading-tight">
            Lost Something? Found Something?
          </h2>
          <p className="text-base sm:text-lg text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Connect lost items with their owners in the Rishihood University community
          </p>
          <button
            onClick={() => setShowReportForm(true)}
            className="bg-primary hover:bg-primary-light text-white px-8 sm:px-10 py-3 sm:py-3.5 rounded-full text-base sm:text-lg font-medium transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 transform group inline-flex items-center gap-2"
          >
            <Plus className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
            Report an Item
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-10 scroll-animate">
          {['all', 'lost', 'found', 'claimed'].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f as typeof filter);
                setCurrentPage(1);
              }}
              className={`px-5 sm:px-7 py-2.5 rounded-full text-sm sm:text-base font-medium transition-all duration-300 ${
                filter === f
                  ? 'bg-primary text-white shadow-md scale-105'
                  : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm hover:shadow-md'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center mt-16 scroll-animate">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
            <h3 className="text-lg font-medium text-gray-700">Waking up the server...</h3>
            <p className="text-sm text-gray-500 mt-1">This takes about 30 seconds on the free tier.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center text-gray-400 mt-16 scroll-animate">
            <p className="text-lg sm:text-xl font-display">No items found</p>
            <p className="mt-3 text-sm sm:text-base">
              {filter === 'claimed' 
                ? 'No items have been claimed yet.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
          </div>
        ) : (
          <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-7 mb-10">
            {paginatedItems.map((item, index) => (
              <div key={item.id} className={`w-full scroll-animate stagger-${(index % 9) + 1}`}>
                <ItemCard 
                  {...item} 
                  onAction={() => setSelectedItem(item)}
                  onDelete={handleDeleteItem}
                />
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-wrap justify-center gap-2 mt-10 scroll-animate">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-4 sm:px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  currentPage === page
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm'
                }`}
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
          onClose={() => {
            setShowReportForm(false);
            loadItems();
          }}
          currentUser={currentUser as any}
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