import { useState, useEffect, createContext, useContext } from 'react';

var GlobalMessageContext = createContext<any>(null);

export const setGlobalMessageContext = (Context: React.Context<any>) => {
    GlobalMessageContext = Context;
}

export const useGlobalMessage = () => {
  const context = useContext(GlobalMessageContext);
  if (!context) {
    throw new Error('useGlobalMessage must be used within a GlobalMessageProvider');
  }
  return context;
}