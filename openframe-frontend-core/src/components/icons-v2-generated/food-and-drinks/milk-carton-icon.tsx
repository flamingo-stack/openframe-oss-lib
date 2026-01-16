import type { SVGProps } from "react";
export interface MilkCartonIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MilkCartonIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MilkCartonIconProps) {
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
        d="M4.249 13.534c1.804-.965 3.951-.868 5.682.278a3.25 3.25 0 0 0 2.802.412l.93-.293a1.125 1.125 0 0 1 .676 2.146l-.929.293c-1.6.505-3.313.25-4.721-.683a3.26 3.26 0 0 0-3.595-.042l-.493.31-.101.058a1.126 1.126 0 0 1-1.1-1.96l.493-.31zm9.894-6.659.114.006a1.126 1.126 0 0 1 0 2.238l-.114.006h-10a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M12.876 8.74c0-.746.266-1.467.75-2.033l2.25-2.624v-.958H8.125V4.5l-.018.2a1.1 1.1 0 0 1-.253.531L5.336 8.17a.88.88 0 0 0-.211.57V19c0 1.035.84 1.875 1.875 1.875h5.876zm2.25 12.135H17c1.036 0 1.875-.84 1.875-1.875V8.74a.88.88 0 0 0-.21-.57l-1.666-1.942-1.664 1.942a.88.88 0 0 0-.21.57v12.135Zm3-16.792 2.247 2.624.17.218c.378.528.582 1.162.582 1.815V19A4.125 4.125 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19V8.74c0-.746.267-1.467.753-2.033l2.247-2.624V3C5.875 1.827 6.827.875 8 .875h8c1.174 0 2.125.952 2.125 2.125v1.083Z"
      />
    </svg>
  );
}
