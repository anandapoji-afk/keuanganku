'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className="relative z-10 bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200/80"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-sm tracking-tight">{title}</h2>
              <motion.button
                type="button"
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(241, 245, 249, 1)' }}
                whileTap={{ scale: 0.88 }}
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 transition-colors"
                aria-label="Tutup"
              >
                <X className="w-4 h-4 stroke-[2.2]" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="p-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
