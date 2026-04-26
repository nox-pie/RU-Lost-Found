import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Item } from '../types';

interface ClaimModalProps {
  item: Item;
  onClose: () => void;
  onSubmit: (claimerInfo: { details: string; sharePhone: boolean }) => void;
}

export default function ClaimModal({ item, onClose, onSubmit }: ClaimModalProps) {
  const [details, setDetails] = useState('');
  const [sharePhone, setSharePhone] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ details, sharePhone });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">
            {item.type === 'lost' ? 'Found This Item?' : 'Claim This Item'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <h3 className="font-medium text-gray-900">{item.title}</h3>
            <p className="text-gray-600 text-sm">{item.description}</p>
            <div className="mt-2 text-sm text-gray-500 bg-blue-50 p-3 rounded">
              Your name and email will be automatically shared with the reporter.
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Details (Optional)</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
                placeholder="Provide any additional details to verify your claim..."
              />
            </div>

            <div className="flex items-center">
              <input
                id="sharePhone"
                type="checkbox"
                checked={sharePhone}
                onChange={(e) => setSharePhone(e.target.checked)}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="sharePhone" className="ml-2 block text-sm text-gray-900">
                Share my phone number with the reporter
              </label>
            </div>

            <button
              type="submit"
              className={`w-full py-2.5 rounded-xl text-white font-medium transition-all duration-300 hover:shadow-md hover:scale-[1.02] transform ${item.type === 'lost' ? 'bg-primary' : 'bg-secondary'}`}
            >
              Send Email & Claim
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}