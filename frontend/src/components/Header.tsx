import React, { useState, useEffect } from 'react';
import { Search, UserCircle, Menu, X } from 'lucide-react';
import ProfileCard from './ProfileCard';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  onReportClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function Header({ onReportClick, searchQuery, onSearchChange }: HeaderProps) {
  const [showProfile, setShowProfile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { userProfile } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 transition-all duration-500 ${scrolled ? 'header-glass shadow-lg' : 'header-solid shadow-md'}`}>
      <div className="w-full mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 bg-white rounded-full flex items-center justify-center border-2 border-secondary shadow-md p-1.5">
              <img 
                src="/ru-symbol.png" 
                alt="Rishihood University" 
                className="h-full w-full object-contain"
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide font-display">
              RU Lost & Found
            </h1>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-soft hover:shadow-md transition-all duration-300 hover:bg-white">
              <Search className="h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search lost items..."
                className="ml-2 outline-none w-64 bg-transparent text-sm"
              />
            </div>
            
            <button 
              onClick={() => setShowProfile(!showProfile)}
              className="text-white hover:text-gray-200 transition duration-300 transform hover:scale-110 overflow-hidden rounded-full h-9 w-9 bg-white/20 flex items-center justify-center ring-2 ring-white/30 hover:ring-white/50"
            >
              {userProfile?.profilePicture ? (
                <img src={userProfile.profilePicture} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <UserCircle className="h-8 w-8" />
              )}
            </button>
          </div>

          <button 
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden text-white focus:outline-none"
          >
            {showMobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {showMobileMenu && (
          <div className="md:hidden py-4 border-t border-white/20 animate-slideDown">
            <div className="flex items-center bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 mb-4 shadow-soft">
              <Search className="h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search lost items..."
                className="ml-2 outline-none w-full bg-transparent"
              />
            </div>
            <button 
              onClick={() => {
                setShowProfile(!showProfile);
                setShowMobileMenu(false);
              }}
              className="text-white hover:text-gray-200 transition duration-300 w-full text-left py-2"
            >
              Profile
            </button>
            <button
              onClick={() => {
                onReportClick();
                setShowMobileMenu(false);
              }}
              className="text-white hover:text-gray-200 transition duration-300 w-full text-left py-2"
            >
              Report Item
            </button>
          </div>
        )}
      </div>

      {showProfile && userProfile && (
        <div className="absolute right-4 top-full mt-2 z-50 animate-slide-down">
          <ProfileCard 
            profile={userProfile}
            onClose={() => setShowProfile(false)}
            onUpdate={async () => {}}
          />
        </div>
      )}
    </header>
  );
}