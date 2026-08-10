import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
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

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

/**
 * `ConvexAuthProvider` keeps the session token in `localStorage`, which is what
 * §14.2 needs it to do: WebKit bug #272325 reverts *session cookies* on iOS
 * 17.x, and the installed PWA is the platform this app is aimed at. Passing a
 * custom `storage` here would be the regression.
 */
createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <RouterProvider router={createBrowserRouter(routes)} />
    </ConvexAuthProvider>
  </StrictMode>,
);
