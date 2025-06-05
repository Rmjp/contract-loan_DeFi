// GlobalMessageContext.jsx
import React, { createContext, useState, useContext } from 'react';

// 1. Create the Context
export const GlobalMessageContext = createContext(null); // Initial value can be anything, often null or an object with default shape

// 2. Create a Provider component to manage the state and provide it
export function GlobalMessageProvider({ children }) {
  const [globalMessage, setGlobalMessage] = useState('');

  // Use useMemo to prevent unnecessary re-renders of consumers if the value object itself
  // is recreated on every render, even if globalMessage or setGlobalMessage haven't changed.
  // (setGlobalMessage is stable, so useMemo here primarily optimizes if other values were added)
  const value = React.useMemo(() => ({ globalMessage, setGlobalMessage }), [globalMessage]);

  return (
    <GlobalMessageContext.Provider value={value}>
      {children}
    </GlobalMessageContext.Provider>
  );
}

// 3. Create a custom hook for easier consumption (optional but good practice)
export function useGlobalMessage() {
  const context = useContext(GlobalMessageContext);
  if (context === null) {
    throw new Error('useGlobalMessage must be used within a GlobalMessageProvider');
  }
  return context;
}