import React from 'react';
import { Mail, Heart, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-primary-dark">
      {/* Campus illustration — inverted + contrast boosted so it's visible through the red */}
      <img 
        src="/campus-illustration.png" 
        alt="" 
        className="absolute bottom-0 left-1/2 pointer-events-none select-none mix-blend-overlay"
        style={{ filter: 'invert(1) contrast(2)', transform: 'translateX(-50%) scale(0.55)', transformOrigin: 'bottom center' }}
      />
      
      {/* Content */}
      <div className="relative z-10 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top section */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                RU Lost & Found
              </h3>
              <p className="text-white/70 text-sm max-w-md">
                Helping the Rishihood University community reconnect with their belongings — one item at a time.
              </p>
            </div>

            <div className="flex flex-col items-center md:items-end gap-3">
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <MapPin className="h-4 w-4" />
                <span>Rishihood University, Sonipat, Haryana</span>
              </div>
              <a 
                href="mailto:prashant.k23csai@nst.rishihood.edu.in"
                className="flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors duration-300"
              >
                <Mail className="h-4 w-4" />
                prashant.k23csai@nst.rishihood.edu.in
              </a>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/20 pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-1 text-sm text-white/60">
                Created with <Heart className="h-3.5 w-3.5 text-white fill-white mx-0.5" /> by Prashant Kumar
              </div>
              <p className="text-xs text-white/40">
                © {new Date().getFullYear()} RU Lost & Found — Rishihood University
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}