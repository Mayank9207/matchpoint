import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
}

export function Button({
  variant = "primary",
  children,
  ...props
}: ButtonProps) {
  // TODO: implement (variant-based styling)
  void variant;
  return (
    <button
      className="rounded-lg px-4 py-2 text-sm font-medium sm:text-base"
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
