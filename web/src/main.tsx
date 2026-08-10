import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';

import '@/styles.css';
import { themeStylesheet } from '@/theme/css-vars';

import { routes } from './routes';

/**
 * The entry point. The role variables go into the document **before first
 * paint**, which is why they are generated here rather than imported as a
 * stylesheet: there is no unthemed flash, and no `useTheme()` context for a
 * component to wait on — a colour is `var(--wt-…)`, resolved by CSS.
 */
const style = document.createElement('style');
style.textContent = themeStylesheet;
document.head.append(style);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <RouterProvider router={createBrowserRouter(routes)} />
  </StrictMode>,
);
