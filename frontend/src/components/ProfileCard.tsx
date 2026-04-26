import React, { useState, useRef } from 'react';
import { UserProfile, School } from '../types';
import { X, User, Pencil, Save, Camera, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const SCHOOLS: School[] = [
  'Newton School of Technology',
  'School of Entrepreneurship',
  'School of Psychology & Education',
  'School of Creativity',
  'School of Healthcare',
  'School of Public Leadership'
];

interface ProfileCardProps {
  profile: UserProfile;
  onClose: () => void;
  onUpdate: (updatedProfile: Partial<UserProfile>) => Promise<void>;
}

export default function ProfileCard({ profile, onClose }: ProfileCardProps) {
  const { logout, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Editable fields
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [year, setYear] = useState(profile.year);
  const [school, setSchool] = useState(profile.school);
  const [enrollmentNumber, setEnrollmentNumber] = useState(profile.enrollmentNumber);
  const [phone, setPhone] = useState(profile.phone || '');
  const [newProfilePic, setNewProfilePic] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) return;
      setNewProfilePic(file);
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setError('');
      setLoading(true);
      const formData = new FormData();
      formData.append('firstName', firstName);
      formData.append('lastName', lastName);
      formData.append('year', year);
      formData.append('school', school);
      formData.append('enrollmentNumber', enrollmentNumber);
      formData.append('phone', phone);
      if (newProfilePic) {
        formData.append('profilePicture', newProfilePic);
      }

      await updateProfile(formData);
      setIsEditing(false);
      setNewProfilePic(null);
      setPreviewUrl(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setYear(profile.year);
    setSchool(profile.school);
    setEnrollmentNumber(profile.enrollmentNumber);
    setPhone(profile.phone || '');
    setNewProfilePic(null);
    setPreviewUrl(null);
    setError('');
  };

  const displayPicture = previewUrl || profile.profilePicture;

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-50 max-h-[80vh] overflow-y-auto border-2 border-secondary">
      <div className="p-4">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">Profile</h3>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} className="text-primary hover:text-primary-light transition-colors" title="Edit Profile">
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-xs mb-3">
            {error}
          </div>
        )}

        <div className="flex flex-col">
          {/* Profile Picture */}
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {displayPicture ? (
                <img src={displayPicture} alt="Profile" className="h-20 w-20 rounded-full object-cover shadow-md border-2 border-primary" />
              ) : (
                <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center shadow-md border-2 border-gray-200">
                  <User className="h-10 w-10 text-gray-400" />
                </div>
              )}
              {isEditing && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1.5 shadow-md hover:bg-primary-light transition-colors"
                  title="Change photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>

            {/* Name */}
            {isEditing ? (
              <div className="mt-3 grid grid-cols-2 gap-2 w-full">
                <input
                  type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  className="px-2 py-1 border rounded text-sm focus:ring-primary focus:border-primary"
                  placeholder="First Name"
                />
                <input
                  type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                  className="px-2 py-1 border rounded text-sm focus:ring-primary focus:border-primary"
                  placeholder="Last Name"
                />
              </div>
            ) : (
              <h4 className="font-semibold text-lg mt-3">
                {profile.firstName} {profile.lastName}
              </h4>
            )}
            <p className="text-gray-600 text-sm">{profile.email}</p>
          </div>

          {/* Details */}
          <div className="mt-4 w-full space-y-3">
            {/* Enrollment Number */}
            <div className="text-sm">
              <span className="text-gray-500">Enrollment Number:</span>
              {isEditing ? (
                <input
                  type="text" value={enrollmentNumber} onChange={(e) => setEnrollmentNumber(e.target.value)}
                  className="ml-2 px-2 py-1 border rounded text-sm w-32 focus:ring-primary focus:border-primary"
                />
              ) : (
                <span className="ml-2 font-medium">{profile.enrollmentNumber}</span>
              )}
            </div>

            {/* Year */}
            <div className="text-sm">
              <span className="text-gray-500">Year:</span>
              {isEditing ? (
                <select
                  value={year} onChange={(e) => setYear(e.target.value)}
                  className="ml-2 px-2 py-1 border rounded text-sm focus:ring-primary focus:border-primary"
                >
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              ) : (
                <span className="ml-2 font-medium">{profile.year}{profile.year === '1' ? 'st' : profile.year === '2' ? 'nd' : profile.year === '3' ? 'rd' : 'th'} Year</span>
              )}
            </div>

            {/* School */}
            <div className="text-sm">
              <span className="text-gray-500">School:</span>
              {isEditing ? (
                <select
                  value={school} onChange={(e) => setSchool(e.target.value)}
                  className="ml-2 px-2 py-1 border rounded text-sm w-full mt-1 focus:ring-primary focus:border-primary"
                >
                  {SCHOOLS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <span className="ml-2 font-medium">{profile.school}</span>
              )}
            </div>

            {/* Phone */}
            <div className="text-sm">
              <span className="text-gray-500">Phone:</span>
              {isEditing ? (
                <input
                  type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="ml-2 px-2 py-1 border rounded text-sm w-40 focus:ring-primary focus:border-primary"
                  placeholder="+91 9876543210"
                />
              ) : (
                <span className="ml-2 font-medium">{profile.phone || 'Not set'}</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 w-full space-y-2">
            {isEditing ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary-light py-2 rounded-md text-sm transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 bg-gray-100 text-gray-600 hover:bg-gray-200 py-2 rounded-md text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={logout}
                className="w-full bg-gray-100 text-gray-600 hover:bg-gray-200 py-2 rounded-md text-sm"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}