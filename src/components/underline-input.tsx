import type { InputHTMLAttributes } from "react";

const MAIN_TEXT = "text-[#16211F]";

export function UnderlineInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border-0 border-b border-neutral-200 bg-transparent py-3 text-lg outline-none transition-colors placeholder:text-neutral-400 focus:border-primary ${MAIN_TEXT} ${props.className ?? ""}`}
    />
  );
}
