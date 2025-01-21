'use client';  

import React, { createContext, useState, useContext, useEffect } from 'react';

export interface SidebarContextType {
  sidebarOpen: boolean;
  isSidebarOpen: boolean; 
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  sidebarOpen: true,
  isSidebarOpen: true,
  toggleSidebar: () => {},
});

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', sidebarOpen ? '16rem' : '4rem');
  }, [sidebarOpen]);

  return (
    <SidebarContext.Provider value={{ 
      sidebarOpen, 
      isSidebarOpen: sidebarOpen, 
      toggleSidebar 
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};
