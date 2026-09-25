import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Dev-only tree contact sheet. import.meta.env.DEV is statically false in
// production builds, so this branch and its chunk are dropped entirely.
if (import.meta.env.DEV && window.location.pathname.startsWith('/dev/trees')) {
  import('./dev/DevTrees.jsx').then(({ default: DevTrees }) => root.render(<DevTrees />));
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
