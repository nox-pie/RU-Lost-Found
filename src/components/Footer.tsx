import React from 'react';
import { Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-primary text-white py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            Created By:- Prashant Kumar
          </div>
          <a 
            href="mailto:prashant.k23csai@nst.rishihood.edu.in"
            className="flex items-center gap-2 hover:text-gray-200 transition-colors"
          >
            <Mail className="h-5 w-5" />
            prashant.k23csai@nst.rishihood.edu.in
          </a>
        </div>
      </div>
    </footer>
  );
}