import React from "react";

export function Input({ className = "", ...props }) {
  return (
    <input
      className={`rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${className}`}
      {...props}
    />
  );
}