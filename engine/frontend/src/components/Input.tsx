import { type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, id, ...props }: InputProps) {
  // TODO: implement (label + input layout, error states)
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        className="rounded-lg border px-3 py-2 text-sm sm:text-base"
        {...props}
      />
    </div>
  );
}

export default Input;
