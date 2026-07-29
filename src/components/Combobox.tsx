import { useState, useRef, useEffect } from 'react';

interface ComboboxProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  onEnter?: (val: string) => void;
  placeholder?: string;
  id?: string;
}

export function Combobox({ options, value, onChange, onEnter, placeholder = "Selecione ou digite...", id }: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        id={id}
        type="text"
        className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 pr-10 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (onEnter) {
              onEnter(query);
              setIsOpen(false);
            }
          }
        }}
        autoComplete="off"
      />
      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      
      {isOpen && filteredOptions.length > 0 && (
        <ul className="absolute z-50 w-full mt-2 max-h-60 overflow-auto bg-white dark:bg-[#1e1b2e] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl py-2 scrollbar-thin">
          {filteredOptions.map((option, idx) => (
            <li
              key={idx}
              className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer text-slate-700 dark:text-slate-300 transition-colors"
              onClick={() => {
                setQuery(option);
                onChange(option);
                setIsOpen(false);
              }}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
