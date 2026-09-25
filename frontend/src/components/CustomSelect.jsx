import { useState, useRef, useEffect } from 'react';
import './CustomSelect.css';

export function CustomSelect({ options, value, onChange, placeholder, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Ensure current value is included in options if it's a custom one (like 'Uncertain - Needs Manual Review' or 'N/A')
  const displayOptions = [...options];
  if (value && !displayOptions.includes(value) && value !== placeholder) {
    displayOptions.push(value);
  }

  return (
    <div className={`custom-select-container ${className}`} ref={containerRef}>
      <button 
        type="button" 
        className="custom-select-trigger" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="custom-select-value">{value || placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div className="custom-select-dropdown">
          {placeholder && (
            <div 
              className="custom-select-option placeholder"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
            >
              {placeholder}
            </div>
          )}
          {displayOptions.map((opt) => (
            <div 
              key={opt}
              className={`custom-select-option ${value === opt ? 'selected' : ''}`}
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
