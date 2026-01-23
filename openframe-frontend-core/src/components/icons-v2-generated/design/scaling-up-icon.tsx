import type { SVGProps } from "react";
export interface ScalingUpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ScalingUpIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ScalingUpIconProps) {
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
        d="M5.875 11V7A1.125 1.125 0 0 1 7 5.875h4l.115.006a1.125 1.125 0 0 1 0 2.238L11 8.125H9.716l4.018 4.018a3.1 3.1 0 0 1 1.265-.268h6l.116.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-6a.875.875 0 0 0-.875.874v6a1.125 1.125 0 1 1-2.25 0v-6c0-.45.096-.878.268-1.265L8.125 9.716V11a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M1.875 18a1.125 1.125 0 0 1 2.25 0c0 .97.738 1.769 1.683 1.865l.192.01.116.006a1.125 1.125 0 0 1 0 2.238L6 22.125l-.422-.022A4.125 4.125 0 0 1 1.875 18m18 0v-8a1.125 1.125 0 0 1 2.25 0v8A4.125 4.125 0 0 1 18 22.125h-8a1.125 1.125 0 0 1 0-2.25h8c1.035 0 1.875-.84 1.875-1.875m-18-4v-4a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 1 1-2.25 0m0-8A4.125 4.125 0 0 1 6 1.875a1.125 1.125 0 0 1 0 2.25c-1.036 0-1.875.84-1.875 1.875a1.125 1.125 0 0 1-2.25 0m18 0c0-1.035-.84-1.875-1.875-1.875a1.125 1.125 0 0 1 0-2.25A4.125 4.125 0 0 1 22.125 6a1.125 1.125 0 0 1-2.25 0m-5.876-4.125.116.006a1.125 1.125 0 0 1 0 2.238L14 4.125h-3.998a1.125 1.125 0 1 1 0-2.25z"
      />
    </svg>
  );
}
