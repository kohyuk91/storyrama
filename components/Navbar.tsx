'use client';

import Image from 'next/image';
import Link from 'next/link';
import { UserButton, SignInButton, useUser } from '@clerk/nextjs';

export default function Navbar() {
  const { isSignedIn } = useUser();

  return (
    <nav className="w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <Image
                src="/storyrama_logo.png"
                alt="StoryRama Logo"
                width={32}
                height={32}
                className="object-contain"
              />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                STORYRAMA
              </span>
            </Link>
          </div>
          
          <div className="flex items-center space-x-6">
            {isSignedIn ? (
              <>
                <Link
                  href="/projects"
                  className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  My Projects
                </Link>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <SignInButton mode="modal">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">
                  Sign In
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

