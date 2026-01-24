import { generateUUID } from './uuid';

const USER_ID_KEY = 'eliza_user_id';
const THEME_KEY = 'eliza_theme';

export function getUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = generateUUID();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

export function getTheme(): 'dark' | 'light' {
  const theme = localStorage.getItem(THEME_KEY);
  return (theme === 'light' || theme === 'dark') ? theme : 'dark';
}

export function setTheme(theme: 'dark' | 'light'): void {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
}
