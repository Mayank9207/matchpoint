import React, { useState, useMemo } from "react";

export function Select({ children, className = "", value, onValueChange, ...props }) {
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(value ?? null);

  const childArray = React.Children.toArray(children);
  const triggerChild = childArray.find(
    (child) => React.isValidElement(child) && child.type === SelectTrigger
  );
  const contentChild = childArray.find(
    (child) => React.isValidElement(child) && child.type === SelectContent
  );
  const items = React.Children.toArray(
    contentChild?.props?.children ??
      childArray.filter(
        (child) => React.isValidElement(child) && child.type === SelectItem
      )
  );

  const selectedValue = value !== undefined ? value : internalValue;
  const selectedLabel = useMemo(() => {
    const match = items.find(
      (child) =>
        React.isValidElement(child) && child.props?.value === selectedValue
    );
    return React.isValidElement(match) ? match.props.children : selectedValue;
  }, [items, selectedValue]);

  const handleTriggerClick = () => setIsOpen((prev) => !prev);

  const handleItemClick = (nextValue) => {
    if (value === undefined) {
      setInternalValue(nextValue);
    }
    if (onValueChange) {
      onValueChange(nextValue);
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} {...props}>
      {triggerChild ? (
        React.cloneElement(triggerChild, {
          onClick: handleTriggerClick,
          selectedLabel,
        })
      ) : (
        <SelectTrigger onClick={handleTriggerClick} selectedLabel={selectedLabel} />
      )}
      {isOpen && (
        <SelectContent className="flex flex-col">
          {items.map((child) => {
            if (!React.isValidElement(child)) return child;
            const childValue = child.props?.value ?? child.props?.children;
            const isSelected = childValue === selectedValue;
            return React.cloneElement(child, {
              onClick: () => {
                if (typeof child.props?.onClick === "function") {
                  child.props.onClick();
                }
                handleItemClick(childValue);
              },
              "data-selected": isSelected ? "true" : "false",
              className: `${child.props?.className ?? ""} ${
                isSelected ? "bg-accent text-accent-foreground" : ""
              }`.trim(),
            });
          })}
        </SelectContent>
      )}
    </div>
  );
}

export function SelectTrigger({ children, className = "", selectedLabel, ...props }) {
  const resolvedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && child.type === SelectValue) {
      return React.cloneElement(child, { selectedLabel });
    }
    return child;
  });

  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${className}`}
      {...props}
    >
      {resolvedChildren ?? selectedLabel ?? <SelectValue placeholder="Select an option" />}
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

export function SelectValue({ placeholder = "Select an option", selectedLabel, className = "", ...props }) {
  return (
    <span className={`text-muted-foreground ${className}`} {...props}>
      {selectedLabel ?? placeholder}
    </span>
  );
}
