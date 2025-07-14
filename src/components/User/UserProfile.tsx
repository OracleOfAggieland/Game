// src/components/User/UserProfile.tsx
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../services/auth';

const UserProfile: React.FC = () => {
  const { currentUser, userData } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!currentUser || !userData) {
    return null;
  }

  return (
    <div className="user-profile">
      <div className="profile-info">
        <h3>Welcome, {userData.displayName}!</h3>
        <div className="stats">
          <div className="stat">
            <span className="stat-label">High Score:</span>
            <span className="stat-value">{userData.highScore}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Games Played:</span>
            <span className="stat-value">{userData.totalGames}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Last Played:</span>
            <span className="stat-value">
              {userData.lastPlayed.toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
      <button onClick={handleSignOut} className="sign-out-btn">
        Sign Out
      </button>
    </div>
  );
};

export default UserProfile;