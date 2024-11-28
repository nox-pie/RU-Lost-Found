import React from 'react';
import { UserProfile } from '../types';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ProfileCardProps {
  profile: UserProfile;
  onClose: () => void;
  onUpdate: (updatedProfile: Partial<UserProfile>) => Promise<void>;
}

export default function ProfileCard({ profile, onClose }: ProfileCardProps) {
  const { logout } = useAuth();

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-50">
      <div className="p-4">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">Profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col">
          <div className="mt-4 text-center">
            <h4 className="font-semibold text-lg">
              {profile.firstName} {profile.lastName}
            </h4>
            <p className="text-gray-600 text-sm">{profile.email}</p>
          </div>

          <div className="mt-4 w-full space-y-2">
            <div className="text-sm">
              <span className="text-gray-500">Enrollment Number:</span>
              <span className="ml-2 font-medium">{profile.enrollmentNumber}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Year:</span>
              <span className="ml-2 font-medium">{profile.year}st Year</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">School:</span>
              <span className="ml-2 font-medium">{profile.school}</span>
            </div>
          </div>

          <div className="mt-6 w-full">
            <button
              onClick={logout}
              className="w-full bg-gray-100 text-gray-600 hover:bg-gray-200 py-2 rounded-md text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}