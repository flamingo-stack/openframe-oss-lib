import type { SVGProps } from "react";
export interface AlphabetBSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetBSquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetBSquareIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M13.375 13.75c0-.622-.504-1.126-1.125-1.126h-1.125v2.25h1.125c.621 0 1.125-.503 1.125-1.125Zm-.5-4a.626.626 0 0 0-.625-.625h-1.125v1.25h1.125l.126-.012c.285-.058.5-.31.5-.613Zm2.25 0a2.86 2.86 0 0 1-.493 1.609 3.375 3.375 0 0 1-2.382 5.766h-2a1.375 1.375 0 0 1-1.375-1.374v-7.5c0-.76.616-1.376 1.376-1.376h1.999a2.876 2.876 0 0 1 2.876 2.875Z"
      />
    </svg>
  );
}
