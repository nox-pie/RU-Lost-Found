import React from 'react';
import { MapPin, Calendar, User, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ItemCardProps {
  id: string;
  type: 'lost' | 'found';
  title: string;
  description: string;
  location: string;
  date: string;
  image: string;
  reporter: string;
  reporterId: string;
  status: 'open' | 'claimed';
  onAction: () => void;
  onDelete: (id: string) => void;
}

export default function ItemCard({ 
  id,
  type, 
  title, 
  description, 
  location, 
  date, 
  image,
  reporter,
  reporterId,
  status,
  onAction,
  onDelete
}: ItemCardProps) {
  const { currentUser } = useAuth();
  const isOwner = currentUser?.uid === reporterId;

  return (
    <div className="card group">
      <div className="relative overflow-hidden">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-48 object-cover transform group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            img.src = 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?w=800&auto=format&fit=crop';
          }}
        />
        <div className={`absolute top-4 right-4 ${
          type === 'lost' ? 'bg-primary' : 'bg-secondary'
        } text-white px-4 py-1 rounded-full text-sm font-medium shadow-md`}>
          {type === 'lost' ? 'Lost' : 'Found'}
        </div>
        {status === 'claimed' && (
          <div className="absolute top-4 left-4 bg-green-500 text-white px-4 py-1 rounded-full text-sm font-medium shadow-md">
            Claimed
          </div>
        )}
      </div>
      
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-semibold text-gray-800 line-clamp-1 group-hover:text-primary transition-colors">
            {title}
          </h3>
          {isOwner && (
            <button
              onClick={() => onDelete(id)}
              className="text-red-500 hover:text-red-700 transition-colors ml-2 transform hover:scale-110"
              title="Delete item"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>
        <p className="text-gray-600 mb-4 line-clamp-2 group-hover:line-clamp-none transition-all duration-300">
          {description}
        </p>
        
        <div className="space-y-2">
          <div className="flex items-center text-gray-500 group-hover:text-gray-700 transition-colors">
            <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="text-sm line-clamp-1">{location}</span>
          </div>
          
          <div className="flex items-center text-gray-500 group-hover:text-gray-700 transition-colors">
            <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="text-sm">{date}</span>
          </div>
          
          <div className="flex items-center text-gray-500 group-hover:text-gray-700 transition-colors">
            <User className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="text-sm line-clamp-1">{reporter}</span>
          </div>
        </div>
        
        {status === 'open' && !isOwner && (
          <button 
            onClick={onAction}
            className={`mt-4 w-full ${
              type === 'lost' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            {type === 'lost' ? 'I Found This' : 'Claim Item'}
          </button>
        )}
      </div>
    </div>
  );
}