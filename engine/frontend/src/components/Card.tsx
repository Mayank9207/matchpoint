import { type HTMLAttributes, type ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, ...props }: CardProps) {
  // TODO: implement (card container styling)
  return (
    <div className="rounded-xl border p-4 shadow-sm sm:p-6" {...props}>
      {children}
    </div>
  );
}

export default Card;
