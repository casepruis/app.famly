import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Joyride({ steps, run, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [targetRect, setTargetRect] = useState(null);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (run && !isActive) {
      setIsActive(true);
      setCurrentStep(0);
    }
  }, [run, isActive]);

  useEffect(() => {
    if (isActive) {
      const step = steps[currentStep];
      const targetElement = document.querySelector(step.target);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'auto', block: 'center' });
        const timer = setTimeout(() => {
          const newRect = targetElement.getBoundingClientRect();
          setTargetRect(newRect);
          calculateTooltipPosition();
        }, 150);
        return () => clearTimeout(timer);
      } else {
        handleNext();
      }
    }
  }, [currentStep, isActive, steps]);

  const calculateTooltipPosition = () => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Always position in upper 30% of screen to avoid mobile nav bars
    const tooltipWidth = Math.min(300, screenWidth - 32);
    const maxTop = screenHeight * 0.3; // Never go below 30% of screen height
    const top = Math.min(60, maxTop); // Start at 60px from top, but never exceed 30% of screen
    
    const left = (screenWidth - tooltipWidth) / 2;

    setTooltipStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${Math.max(16, left)}px`,
      width: `${tooltipWidth}px`,
      zIndex: 60,
    });
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleStop();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStop = () => {
    setIsActive(false);
    setTargetRect(null);
    if (onComplete) onComplete();
  };

  if (!isActive || !targetRect) return null;

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50"
        onClick={handleStop}
      />

      {/* Highlight Box */}
      <motion.div
        initial={false}
        animate={{
          top: targetRect.y,
          left: targetRect.x,
          width: targetRect.width,
          height: targetRect.height,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        style={{
          position: 'fixed',
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          borderRadius: '8px',
          pointerEvents: 'none',
          zIndex: 51,
        }}
      />
      
      {/* Tooltip - Always in upper area */}
      <motion.div
        key={currentStep}
        ref={tooltipRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        style={tooltipStyle}
        className="bg-white rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <h3 className="font-bold text-lg mb-2 text-gray-900">{step.title}</h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{step.content}</p>
        </div>
        
        <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-t">
          <span className="text-xs text-gray-500 font-medium">
            {currentStep + 1} / {steps.length}
          </span>
          
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button 
                onClick={handlePrev} 
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Previous
              </button>
            )}
            <button 
              onClick={handleNext}
              className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm"
            >
              {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
        
        <button 
          onClick={handleStop} 
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-2 text-lg leading-none"
        >
          ×
        </button>
      </motion.div>
    </div>
  );
}