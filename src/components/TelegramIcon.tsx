import React from 'react';

export const OFFICIAL_INSTAGRAM_URL = 'https://www.instagram.com/youneel.i';
export const OFFICIAL_TELEGRAM_URL = 'https://t.me/youne_el_i';

interface TelegramIconProps {
  className?: string;
}

export const TelegramIcon: React.FC<TelegramIconProps> = ({ className = 'w-4 h-4' }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M21.944 2.506a1.5 1.5 0 0 0-1.6-.22L2.46 9.81a1.5 1.5 0 0 0 .105 2.8l4.66 1.553 1.79 5.568a1.2 1.2 0 0 0 2.02.46l2.61-2.742 4.655 3.438a1.5 1.5 0 0 0 2.362-.903l2.9-15.9a1.5 1.5 0 0 0-.618-1.578Zm-3.68 3.74-8.19 7.36a.75.75 0 0 0-.236.445l-.365 2.416-1.15-3.57a.75.75 0 0 1 .342-.88l9.599-5.771Z" />
    </svg>
  );
};
