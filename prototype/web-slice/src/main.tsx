import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './styles.css';
import { themeStylesheet } from './theme/css-vars';

// The generated role variables go in before first paint, so there is no
// unthemed flash and no `useTheme()` context to wait on.
const style = document.createElement('style');
style.textContent = themeStylesheet;
document.head.append(style);

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </StrictMode>,
);
