import React, { useState } from 'react';
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
  const { userProfile } = useAuth();

  return (
    <header className="bg-gradient-to-r from-primary to-primary-dark shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
              RU Lost & Found
            </h1>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-soft hover:shadow-md transition-all duration-300">
              <Search className="h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search lost items..."
                className="ml-2 outline-none w-64 bg-transparent"
              />
            </div>
            
            <button 
              onClick={() => setShowProfile(!showProfile)}
              className="text-white hover:text-gray-200 transition duration-300 transform hover:scale-110"
            >
              <UserCircle className="h-8 w-8" />
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
          <div className="md:hidden py-4 border-t border-primary-light animate-fadeIn">
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
        <div className="absolute right-4 top-full mt-2 z-50">
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