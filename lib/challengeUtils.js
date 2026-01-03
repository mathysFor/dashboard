/**
 * Utility functions for challenge management
 */

/**
 * Calculates the next Sunday that is exactly 2 weeks from now.
 * If today is Sunday, it takes the next Sunday + 2 weeks.
 * 
 * @returns {Date} The date of the Sunday in 2 weeks
 */
export function getNextSundayInTwoWeeks() {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Calculate days until next Sunday
  // If today is Sunday (0), we want next Sunday (7 days)
  // Otherwise, we want the upcoming Sunday
  const daysUntilNextSunday = currentDay === 0 ? 7 : 7 - currentDay;
  
  // Create date for next Sunday
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilNextSunday);
  nextSunday.setHours(0, 0, 0, 0); // Set to midnight
  
  // Add 2 weeks (14 days) to get the Sunday in 2 weeks
  const sundayInTwoWeeks = new Date(nextSunday);
  sundayInTwoWeeks.setDate(nextSunday.getDate() + 14);
  
  return sundayInTwoWeeks;
}

