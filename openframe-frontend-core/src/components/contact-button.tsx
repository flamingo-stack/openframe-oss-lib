"use client";

interface ContactButtonProps {
  children: React.ReactNode;
  className?: string;
}

export function ContactButton({ children, className }: ContactButtonProps) {
  const handleClick = () => {
    window.location.href = '/contact';
  };

  return (
    <button
      onClick={handleClick}
      className={className}
    >
      {children}
    </button>
  );
} 