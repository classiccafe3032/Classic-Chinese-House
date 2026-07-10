const React = require('react');
const { renderToString } = require('react-dom/server');

// Just mock enough to test if the JSX evaluates without crashing
console.log("We can't easily mock this because it imports from @/lib/apiClient, lucide-react, framer-motion which are ESM/TSX.");
