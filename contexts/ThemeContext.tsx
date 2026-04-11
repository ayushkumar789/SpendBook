import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors, AppColors } from '../constants/colors';

const THEME_KEY = '@spendbook_theme';

interface ThemeContextValue {
  isDark: boolean;
  colors: AppColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  colors: LightColors,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialise from system preference; AsyncStorage will override on mount.
  const [isDark, setIsDark] = useState<boolean>(Appearance.getColorScheme() === 'dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'dark') setIsDark(true);
      else if (saved === 'light') setIsDark(false);
      // null → keep system default already set above
    });
  }, []);

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? DarkColors : LightColors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
