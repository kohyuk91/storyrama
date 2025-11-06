'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function ConditionalNavbar() {
  const pathname = usePathname();
  
  // Hide navbar for project detail pages
  if (pathname?.startsWith('/projects/') && pathname !== '/projects') {
    return null;
  }
  
  return <Navbar />;
}

