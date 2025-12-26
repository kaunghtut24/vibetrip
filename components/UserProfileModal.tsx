import React, { useState, useEffect } from 'react';
import { UserProfile, UserPreferences } from '../types';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: (updatedProfile: UserProfile) => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, profile, onSave }) => {
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [newAccess, setNewAccess] = useState('');
  const [newDiet, setNewDiet] = useState('');

  useEffect(() => {
    setFormData(profile);
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof UserPreferences, value: any) => {
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [field]: value
      }
    }));
  };

  const addListItem = (field: 'accessibility' | 'dietaryRestrictions', value: string, setter: (s: string) => void) => {
    if (!value.trim()) return;
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [field]: [...prev.preferences[field], value.trim()]
      }
    }));
    setter('');
  };

  const removeListItem = (field: 'accessibility' | 'dietaryRestrictions', index: number) => {
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [field]: prev.preferences[field].filter((_, i) => i !== index)
      }
    }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden m-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gray-900 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Traveler Profile</h2>
            <p className="text-gray-400 text-sm">Customize your default AI settings</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Section: Basic Preferences */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Pace</label>
              <select 
                value={formData.preferences.pace}
                onChange={(e) => handleChange('pace', e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Relaxed">Relaxed (Slow)</option>
                <option value="Moderate">Moderate (Standard)</option>
                <option value="Fast Paced">Fast Paced (Packed)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Budget</label>
              <select 
                value={formData.preferences.budgetTier}
                onChange={(e) => handleChange('budgetTier', e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Budget">Budget ($)</option>
                <option value="Moderate">Moderate ($$)</option>
                <option value="Luxury">Luxury ($$$)</option>
              </select>
            </div>
          </div>

          {/* Section: Accessibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <i className="fa-solid fa-wheelchair mr-1 text-blue-600"></i> Accessibility Needs
            </label>
            <div className="flex gap-2 mb-2">
              <input 
                type="text" 
                value={newAccess}
                onChange={(e) => setNewAccess(e.target.value)}
                placeholder="e.g. Minimal walking, Wheelchair accessible"
                className="flex-1 border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && addListItem('accessibility', newAccess, setNewAccess)}
              />
              <button 
                onClick={() => addListItem('accessibility', newAccess, setNewAccess)}
                className="bg-gray-100 hover:bg-gray-200 px-3 rounded-lg text-gray-600"
              >
                <i className="fa-solid fa-plus"></i>
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.preferences.accessibility.map((item, idx) => (
                <span key={idx} className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-100 flex items-center gap-1">
                  {item}
                  <button onClick={() => removeListItem('accessibility', idx)} className="hover:text-blue-900"><i className="fa-solid fa-xmark"></i></button>
                </span>
              ))}
              {formData.preferences.accessibility.length === 0 && (
                <span className="text-xs text-gray-400 italic">No constraints set.</span>
              )}
            </div>
          </div>

          {/* Section: Dietary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <i className="fa-solid fa-utensils mr-1 text-green-600"></i> Dietary Restrictions
            </label>
            <div className="flex gap-2 mb-2">
              <input 
                type="text" 
                value={newDiet}
                onChange={(e) => setNewDiet(e.target.value)}
                placeholder="e.g. Vegetarian, Gluten-Free"
                className="flex-1 border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && addListItem('dietaryRestrictions', newDiet, setNewDiet)}
              />
              <button 
                onClick={() => addListItem('dietaryRestrictions', newDiet, setNewDiet)}
                className="bg-gray-100 hover:bg-gray-200 px-3 rounded-lg text-gray-600"
              >
                <i className="fa-solid fa-plus"></i>
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.preferences.dietaryRestrictions.map((item, idx) => (
                <span key={idx} className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded-full border border-green-100 flex items-center gap-1">
                  {item}
                  <button onClick={() => removeListItem('dietaryRestrictions', idx)} className="hover:text-green-900"><i className="fa-solid fa-xmark"></i></button>
                </span>
              ))}
               {formData.preferences.dietaryRestrictions.length === 0 && (
                <span className="text-xs text-gray-400 italic">No restrictions set.</span>
              )}
            </div>
          </div>

          {/* Stats / History */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
             <div className="flex justify-between items-center text-xs text-gray-500">
                <span>User ID: <span className="font-mono">{formData.id}</span></span>
                <span>Trips Planned: <span className="font-bold">{formData.tripHistory.length}</span></span>
             </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium">Cancel</button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all">
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;