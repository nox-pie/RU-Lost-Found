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
    <div className="card group w-full h-full flex flex-col">
      <div className="relative overflow-hidden">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-52 object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            img.src = 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?w=800&auto=format&fit=crop';
          }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className={`absolute top-4 right-4 ${
          type === 'lost' ? 'bg-primary' : 'bg-secondary'
        } text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-md uppercase tracking-wide`}>
          {type === 'lost' ? 'Lost' : 'Found'}
        </div>
        {status === 'claimed' && (
          <div className="absolute top-4 left-4 bg-green-500 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-md uppercase tracking-wide">
            Claimed
          </div>
        )}
      </div>
      
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-gray-800 line-clamp-1 group-hover:text-primary transition-colors duration-300">
            {title}
          </h3>
          {isOwner && (
            <button
              onClick={() => onDelete(id)}
              className="text-red-400 hover:text-red-600 transition-colors ml-2 transform hover:scale-110"
              title="Delete item"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>
          )}
        </div>
        <p className="text-gray-500 mb-4 line-clamp-2 text-sm leading-relaxed">
          {description}
        </p>
        
        <div className="space-y-2 mt-auto">
          <div className="flex items-center text-gray-400 group-hover:text-gray-600 transition-colors duration-300">
            <MapPin className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
            <span className="text-xs line-clamp-1">{location}</span>
          </div>
          
          <div className="flex items-center text-gray-400 group-hover:text-gray-600 transition-colors duration-300">
            <Calendar className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
            <span className="text-xs">{date}</span>
          </div>
          
          <div className="flex items-center text-gray-400 group-hover:text-gray-600 transition-colors duration-300">
            <User className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
            <span className="text-xs line-clamp-1">{reporter}</span>
          </div>
        </div>
        
        {status === 'open' && !isOwner && (
          <div className="flex flex-col space-y-2 mt-auto pt-5">
            <button 
              onClick={onAction}
              className={`w-full py-2.5 rounded-xl font-medium text-white text-sm transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md ${
                type === 'lost' ? 'bg-primary hover:bg-primary-light' : 'bg-secondary hover:bg-opacity-90'
              }`}
            >
              {type === 'lost' ? 'I Found This' : 'Claim Item'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}