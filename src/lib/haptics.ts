// Haptic feedback utilities using the Web Vibration API

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

const patterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 50, 10, 50, 10],
  warning: [20, 100, 20],
  error: [50, 100, 50, 100, 50],
  selection: 5,
};

/**
 * Triggers haptic feedback if the device supports it
 * @param pattern - The type of haptic feedback to trigger
 * @returns boolean indicating if vibration was triggered
 */
export function triggerHaptic(pattern: HapticPattern = 'light'): boolean {
  if (typeof window === 'undefined') return false;

  // Check if the Vibration API is supported
  if (!('vibrate' in navigator)) return false;

  const vibrationPattern = patterns[pattern];

  try {
    return navigator.vibrate(vibrationPattern);
  } catch (error) {
    console.warn('Vibration API error:', error);
    return false;
  }
}

/**
 * Stop all ongoing vibrations
 */
export function stopHaptic(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('vibrate' in navigator)) return false;

  try {
    return navigator.vibrate(0);
  } catch (error) {
    console.warn('Vibration API error:', error);
    return false;
  }
}

/**
 * Check if the device supports haptic feedback
 */
export function supportsHaptic(): boolean {
  if (typeof window === 'undefined') return false;
  return 'vibrate' in navigator;
}
