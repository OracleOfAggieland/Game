// src/services/auth.ts
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  highScore: number;
  totalGames: number;
  createdAt: Date;
  lastPlayed: Date;
}

// Sign up new user
export const signUp = async (email: string, password: string, displayName: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update profile with display name
    await updateProfile(user, { displayName });
    
    // Create user document in Firestore
    const userData: UserData = {
      uid: user.uid,
      email: user.email!,
      displayName,
      highScore: 0,
      totalGames: 0,
      createdAt: new Date(),
      lastPlayed: new Date()
    };
    
    await setDoc(doc(db, 'users', user.uid), userData);
    
    return { user, userData };
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
};

// Sign in existing user
export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

// Sign out user
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Get user data from Firestore
export const getUserData = async (uid: string): Promise<UserData | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        ...data,
        createdAt: data.createdAt.toDate(),
        lastPlayed: data.lastPlayed.toDate()
      } as UserData;
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
};

// Update user stats after game
export const updateUserStats = async (uid: string, score: number) => {
  try {
    const userData = await getUserData(uid);
    if (userData) {
      const newHighScore = Math.max(userData.highScore, score);
      const updatedData = {
        highScore: newHighScore,
        totalGames: userData.totalGames + 1,
        lastPlayed: new Date()
      };
      
      await setDoc(doc(db, 'users', uid), updatedData, { merge: true });
      return updatedData;
    }
  } catch (error) {
    console.error('Error updating user stats:', error);
    throw error;
  }
};

// Listen to auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};