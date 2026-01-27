import React from "react";

export function Label({ children, className = "", ...props }) {
  return (
    <label className={`block text-sm font-medium text-muted-foreground ${className}`} {...props}>
      {children}
    </label>
  );
}