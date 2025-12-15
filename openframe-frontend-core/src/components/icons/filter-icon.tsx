import React from 'react'

interface FilterIconProps {
  className?: string
  size?: number
}

export const FilterIcon: React.FC<FilterIconProps> = ({ className = '', size = 20 }) => {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 11.25C10.4142 11.25 10.75 11.5858 10.75 12C10.75 12.4142 10.4142 12.75 10 12.75H6C5.58579 12.75 5.25 12.4142 5.25 12C5.25 11.5858 5.58579 11.25 6 11.25H10Z" fill="#888888" />
      <path d="M12 7.25C12.4142 7.25 12.75 7.58579 12.75 8C12.75 8.41421 12.4142 8.75 12 8.75H4C3.58579 8.75 3.25 8.41421 3.25 8C3.25 7.58579 3.58579 7.25 4 7.25H12ZM14 3.25C14.4142 3.25 14.75 3.58579 14.75 4C14.75 4.41421 14.4142 4.75 14 4.75H2C1.58579 4.75 1.25 4.41421 1.25 4C1.25 3.58579 1.58579 3.25 2 3.25H14Z" fill="#888888" />
    </svg>
  );
};