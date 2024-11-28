import React, { useState } from 'react';
import { X } from 'lucide-react';
import { User } from 'firebase/auth';
import { createItem } from '../services/itemService';
import { useAuth } from '../contexts/AuthContext';

interface ReportFormProps {
  onClose: () => void;
  currentUser: User | null;
}

export default function ReportForm({ onClose, currentUser }: ReportFormProps) {
  const { userProfile } = useAuth();
  const [type, setType] = useState<'lost' | 'found'>('lost');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    date: new Date().toISOString().split('T')[0],
    imageUrl: '',
  });
  const [loading, setLoading] = useState(false);

  const fullName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;

    if (!formData.title || !formData.description || !formData.location) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      await createItem({
        type,
        ...formData,
        reporter: fullName || currentUser.email || 'Anonymous',
        reporterId: currentUser.uid,
      });
      onClose();
    } catch (error) {
      console.error('Error creating item:', error);
      alert('Failed to create report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Report {type === 'lost' ? 'Lost' : 'Found'} Item</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex gap-4 mb-4">
            <button
              type="button"
              className={`flex-1 py-2 rounded-md ${type === 'lost' ? 'bg-primary text-white' : 'bg-gray-100'}`}
              onClick={() => setType('lost')}
            >
              Lost Item
            </button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-md ${type === 'found' ? 'bg-secondary text-white' : 'bg-gray-100'}`}
              onClick={() => setType('found')}
            >
              Found Item
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Reporter Info - Read Only */}
            <div className="space-y-4 bg-gray-50 p-3 rounded-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reporter Name</label>
                <input
                  type="text"
                  value={fullName}
                  className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-700"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={currentUser?.email || ''}
                  className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-700"
                  disabled
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="What did you lose/find?"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
                placeholder="Provide details about the item..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Where was it lost/found?"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (Optional)</label>
              <input
                type="url"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 rounded-md text-white ${
                type === 'lost' ? 'bg-primary' : 'bg-secondary'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}