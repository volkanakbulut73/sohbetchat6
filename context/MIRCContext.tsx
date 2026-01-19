import React, { createContext, useContext } from 'react';
import PocketBase from 'pocketbase';

interface MIRCContextType {
  pb: PocketBase;
}

const MIRCContext = createContext<MIRCContextType | null>(null);

export const MIRCProvider: React.FC<{ pb: PocketBase; children: React.ReactNode }> = ({ 
  pb, 
  children 
}) => {
  return (
    <MIRCContext.Provider value={{ pb }}>
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