
import React from 'react';

interface CardProps {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export const Card: React.FC<CardProps> = ({ title, children, className = '', fullWidth = false }) => {
  return (
    <div className={`bg-app-panel border border-app-panel-border rounded-xl shadow-lg p-3 ${fullWidth ? 'col-span-full' : ''} ${className}`}>
      <h2 className="text-base font-bold text-[#003399] mb-2 mt-1">{title}</h2>
      {children}
    </div>
  );
};
