import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { createItem } from '../services/itemService';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile } from '../types';

interface ReportFormProps {
  onClose: () => void;
  currentUser: UserProfile | null;
}

export default function ReportForm({ onClose, currentUser }: ReportFormProps) {
  const { userProfile } = useAuth();
  const [type, setType] = useState<'lost' | 'found'>('lost');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fullName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : '';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      alert('Please upload an image file (JPEG, PNG, etc.)');
      return;
    }
    
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);
    
    // Create a preview URL
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const removeFile = () => {
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;

    if (!formData.title || !formData.description || !formData.location) {
      alert('Please fill in all text fields');
      return;
    }

    if (!file) {
      alert('An image is required. Please upload a photo of the item.');
      return;
    }

    try {
      setLoading(true);
      
      const submitData = new FormData();
      submitData.append('type', type);
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('location', formData.location);
      submitData.append('date', new Date().toISOString().split('T')[0]);
      submitData.append('reporter', fullName || currentUser.email || 'Anonymous');
      submitData.append('image', file); // This matches the 'upload.single("image")' on the backend
      
      await createItem(submitData as any);
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md my-8 shadow-2xl animate-fade-in">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold font-display">Report {type === 'lost' ? 'Lost' : 'Found'} Item</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex gap-4 mb-4">
            <button
              type="button"
              className={`flex-1 py-2 rounded-md transition-colors ${type === 'lost' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              onClick={() => setType('lost')}
            >
              Lost Item
            </button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-md transition-colors ${type === 'found' ? 'bg-secondary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              onClick={() => setType('found')}
            >
              Found Item
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            {/* Image Upload Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload Photo (Mandatory) *</label>
              <div 
                className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors ${
                  isDragging ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary hover:bg-gray-50'
                } ${previewUrl ? 'hidden' : 'block'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="space-y-1 text-center cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 justify-center">
                    <span className="relative rounded-md font-medium text-primary hover:text-primary-light focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
                      <span>Upload a file</span>
                      <input 
                        id="file-upload" 
                        name="file-upload" 
                        type="file" 
                        className="sr-only" 
                        accept="image/jpeg,image/png,image/webp"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                      />
                    </span>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, WEBP up to 5MB</p>
                </div>
              </div>

              {/* Image Preview */}
              {previewUrl && (
                <div className="mt-2 relative rounded-md overflow-hidden border border-gray-200">
                  <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover" />
                  <div className="absolute top-0 right-0 p-2">
                    <button
                      type="button"
                      onClick={removeFile}
                      className="bg-white rounded-full p-1 shadow-md hover:bg-red-50 text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 text-xs flex items-center">
                    <ImageIcon className="h-3 w-3 mr-1" />
                    <span className="truncate">{file?.name}</span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !file}
              className={`w-full py-3 rounded-xl text-white font-medium transition-all duration-300 hover:shadow-md hover:scale-[1.02] transform ${
                type === 'lost' ? 'bg-primary hover:bg-primary-light' : 'bg-secondary hover:bg-opacity-90'
              } ${(loading || !file) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}