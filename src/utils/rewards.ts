import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Calculates current progress points towards the next Destaque credit.
 * Threshold is 150 points.
 */
export const POINTS_THRESHOLD = 150;
export const POINTS_PER_REFERRAL = 50;
export const POINTS_PER_AD = 5;

/**
 * Calculates the total accumulated points of a user based on referrals and approved ads.
 */
export const calculateTotalPoints = (referredUsersCount: number = 0, pointsFromAds: number = 0): number => {
  return (referredUsersCount * POINTS_PER_REFERRAL) + pointsFromAds;
};

/**
 * Calculates how many points are currently in progress towards the next credit (0 to 149).
 */
export const calculateProgressPoints = (totalPoints: number): number => {
  return totalPoints % POINTS_THRESHOLD;
};

/**
 * Handles awarding points to a seller for an approved ad.
 * Ensures the points are only awarded if they haven't been awarded already (using pointsEarned flag on the ad).
 * This function also calculates if the user reached a multiple of 150 points, awarding Destaque credits.
 * 
 * @param sellerId The ID of the seller
 * @param adId The ID of the ad being approved
 */
export const awardAdApprovalPoints = async (sellerId: string, adId: string): Promise<boolean> => {
  if (!sellerId || !adId) return false;
  
  try {
    // 1. Fetch the ad to make sure points weren't already earned
    const adRef = doc(db, 'ads', adId);
    const adSnap = await getDoc(adRef);
    
    if (!adSnap.exists()) return false;
    const adData = adSnap.data();
    
    if (adData.pointsEarned === true) {
      console.log(`Ad ${adId} already generated points.`);
      return false;
    }
    
    // 2. Fetch user profile to calculate the correct points and credits delta
    const userRef = doc(db, 'users', sellerId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return false;
    const userData = userSnap.data();
    
    const referredUsersCount = userData.referredUsersCount || 0;
    const pointsFromAds = userData.pointsFromAds || 0;
    const currentCredits = userData.referralCredits || 0;
    
    // Calculate total points before and after
    const oldPoints = calculateTotalPoints(referredUsersCount, pointsFromAds);
    const newPointsFromAds = pointsFromAds + POINTS_PER_AD; // +5 points for approved ad
    const newPoints = calculateTotalPoints(referredUsersCount, newPointsFromAds);
    
    // Check if new credits should be granted
    const oldCreditsEarned = Math.floor(oldPoints / POINTS_THRESHOLD);
    const newCreditsEarned = Math.floor(newPoints / POINTS_THRESHOLD);
    const creditsToGrant = Math.max(0, newCreditsEarned - oldCreditsEarned);
    
    // 3. Perform the updates inside DB
    await updateDoc(adRef, {
      pointsEarned: true
    });
    
    await updateDoc(userRef, {
      pointsFromAds: newPointsFromAds,
      referralCredits: currentCredits + creditsToGrant
    });
    
    console.log(`Successfully awarded +5 points to user ${sellerId}. Credits earned: ${creditsToGrant}.`);
    return true;
  } catch (error) {
    console.error('Error awarding ad approval points:', error);
    return false;
  }
};

/**
 * Manually adds highlight credits to a specific user for debug/testing purposes.
 */
export const manualAddCredits = async (userId: string, amount: number): Promise<boolean> => {
  if (!userId) return false;
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return false;
    
    const userData = userSnap.data();
    const currentCredits = userData.referralCredits || 0;
    
    await updateDoc(userRef, {
      referralCredits: Math.max(0, currentCredits + amount)
    });
    return true;
  } catch (error) {
    console.error('Error manually adding credits:', error);
    return false;
  }
};

/**
 * Manually adds points (pointsFromAds) to a user for debug/testing purposes.
 * Automatically checks and transitions into Destaque credits if thresholds (150 pts multiples) are crossed.
 */
export const manualAddPoints = async (userId: string, amount: number): Promise<boolean> => {
  if (!userId) return false;
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return false;
    
    const userData = userSnap.data();
    const referredUsersCount = userData.referredUsersCount || 0;
    const pointsFromAds = userData.pointsFromAds || 0;
    const currentCredits = userData.referralCredits || 0;
    
    const oldPoints = calculateTotalPoints(referredUsersCount, pointsFromAds);
    const newPointsFromAds = pointsFromAds + amount;
    const newPoints = calculateTotalPoints(referredUsersCount, newPointsFromAds);
    
    const oldCreditsEarned = Math.floor(oldPoints / POINTS_THRESHOLD);
    const newCreditsEarned = Math.floor(newPoints / POINTS_THRESHOLD);
    const creditsToGrant = Math.max(0, newCreditsEarned - oldCreditsEarned);
    
    await updateDoc(userRef, {
      pointsFromAds: newPointsFromAds,
      referralCredits: currentCredits + creditsToGrant
    });
    return true;
  } catch (error) {
    console.error('Error manually adding points:', error);
    return false;
  }
};

