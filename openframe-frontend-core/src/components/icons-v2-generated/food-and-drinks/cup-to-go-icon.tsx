import type { SVGProps } from "react";
export interface CupToGoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CupToGoIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CupToGoIconProps) {
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
        d="M19.131 3.882c.617.073 1.059.633.986 1.25l-1.687 14.35a4.126 4.126 0 0 1-4.098 3.643H9.668a4.125 4.125 0 0 1-4.097-3.644L3.882 5.131l-.007-.115a1.126 1.126 0 0 1 2.224-.26l.019.112.353 3.007h11.058l.354-3.007a1.125 1.125 0 0 1 1.248-.986M7.805 19.22a1.876 1.876 0 0 0 1.863 1.655h4.665c.95 0 1.75-.71 1.861-1.655l1.071-9.094H6.735z"
      />
      <path
        fill={color}
        d="M12.876 15a.876.876 0 1 0-1.75 0 .876.876 0 0 0 1.75 0M16 .876a1.125 1.125 0 0 1 0 2.25h-1.806c-.374 0-.7.237-.823.579l-.04.152-.003.019H20l.115.006a1.125 1.125 0 0 1 0 2.238L20 6.125H4a1.125 1.125 0 0 1 0-2.25h7.047l.065-.388.058-.279A3.126 3.126 0 0 1 14.194.875H16Zm-.874 14.126a3.126 3.126 0 1 1-6.252-.003 3.126 3.126 0 0 1 6.252.003"
      />
    </svg>
  );
}
