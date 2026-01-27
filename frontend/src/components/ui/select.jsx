import React, { useState } from "react";

export function Select({ children, className = "", ...props }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(null);

  const handleTriggerClick = () => {
    setIsOpen(!isOpen);
  };

  const handleItemClick = (value) => {
    setSelectedValue(value);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} {...props}>
      <SelectTrigger onClick={handleTriggerClick}>
        {selectedValue ? selectedValue : <SelectValue placeholder="Select an option" />}
      </SelectTrigger>
      {isOpen && (
        <SelectContent>
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child, {
                onClick: () => handleItemClick(child.props.children),
              });
            }
            return child;
          })}
        </SelectContent>
      )}
    </div>
  );
}

export function SelectTrigger({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SelectContent({ children, className = "", ...props }) {
  return (
    <ul
      className={`absolute z-10 mt-2 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-lg max-h-60 overflow-auto ${className}`}
      {...props}
    >
      {children}
    </ul>
  );
}

export function SelectItem({ children, className = "", onClick, ...props }) {
  return (
    <li
      className={`cursor-pointer rounded-sm px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </li>
  );
}

export function SelectValue({ placeholder, className = "", ...props }) {
  return (
    <span className={`text-muted-foreground ${className}`} {...props}>
      {placeholder}
    </span>
  );
}