// PageWithLayout.jsx
import { useLocation } from 'react-router-dom';
import Layout from './Layout';

function getCurrentPageName(pathname) {
  const cleaned = pathname.split('/').filter(Boolean)[0] || 'Index';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export default function PageWithLayout({ children }) {
  const location = useLocation();
  const currentPageName = getCurrentPageName(location.pathname);
  return <Layout currentPageName={currentPageName}>{children}</Layout>;
}
