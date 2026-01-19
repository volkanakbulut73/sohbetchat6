import React, { createContext, useContext } from 'react';
import PocketBase from 'pocketbase';

interface MIRCContextType {
  pb: PocketBase;
  geminiApiKey?: string;
}

const MIRCContext = createContext<MIRCContextType | null>(null);

export const MIRCProvider: React.FC<{ pb: PocketBase; geminiApiKey?: string; children: React.ReactNode }> = ({ 
  pb, 
  geminiApiKey, 
  children 
}) => {
  return (
    <MIRCContext.Provider value={{ pb, geminiApiKey }}>
      {children}
    </MIRCContext.Provider>
  );
};

export const useMIRCContext = () => {
  const context = useContext(MIRCContext);
  if (!context) {
    throw new Error('useMIRCContext must be used within a MIRCProvider');
  }
  return context;
};