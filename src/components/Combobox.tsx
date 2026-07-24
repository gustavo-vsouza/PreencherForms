import { useState, useRef, useEffect } from 'react';

interface ComboboxProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  id?: string;
}

export function Combobox({ options, value, onChange, placeholder = "Selecione ou digite...", id }: ComboboxProps) {
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
    <div className="combobox-wrapper" ref={wrapperRef}>
      <input
        id={id}
        type="text"
        className="combobox-input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        autoComplete="off"
      />
      <svg className="combobox-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
      
      {isOpen && filteredOptions.length > 0 && (
        <ul className="combobox-dropdown">
          {filteredOptions.map((option, idx) => (
            <li
              key={idx}
              className="combobox-option"
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
