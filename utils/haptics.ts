
/**
 * Utility to trigger Telegram Native Haptic Feedback.
 * Provides a "premium" feel on iOS/Android within Telegram.
 * Falls back to navigator.vibrate for browsers.
 */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotificationType = 'error' | 'success' | 'warning';

export const triggerHaptic = (
  type: HapticStyle | 'selection' | NotificationType = 'light'
) => {
  const tg = (window as any).Telegram?.WebApp;

  // 1. Telegram Native Haptics (The best experience)
  if (tg?.HapticFeedback) {
    switch (type) {
      case 'selection':
        tg.HapticFeedback.selectionChanged();
        break;
      
      case 'error':
      case 'success':
      case 'warning':
        tg.HapticFeedback.notificationOccurred(type);
        break;
      
      default:
        // impactOccurred supports: light, medium, heavy, rigid, soft
        tg.HapticFeedback.impactOccurred(type);
        break;
    }
    return;
  }

  // 2. Browser Fallback (navigator.vibrate)
  // Note: iOS Safari often blocks this, but works on Android Chrome
  if (navigator.vibrate) {
    switch (type) {
      case 'selection':
      case 'light':
        navigator.vibrate(5); // Very short tick
        break;
      case 'medium':
        navigator.vibrate(10);
        break;
      case 'heavy':
      case 'rigid':
        navigator.vibrate(15);
        break;
      case 'soft':
        navigator.vibrate([5, 5]);
        break;
      case 'success':
        navigator.vibrate([10, 30, 10]);
        break;
      case 'warning':
        navigator.vibrate([30, 50]);
        break;
      case 'error':
        navigator.vibrate([50, 50, 50]);
        break;
    }
  }
};
