import type { SVGProps } from "react";
export interface MedicalIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MedicalIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MedicalIconProps) {
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
        d="M13.875 4.5a.375.375 0 0 0-.375-.375h-3a.375.375 0 0 0-.375.375V9c0 .621-.504 1.125-1.125 1.125H4.5a.375.375 0 0 0-.375.375v3c0 .207.168.375.375.375H9c.621 0 1.125.504 1.125 1.125v4.5c0 .207.168.375.375.375h3a.375.375 0 0 0 .375-.375V15c0-.621.504-1.125 1.125-1.125h4.5a.375.375 0 0 0 .375-.375v-3a.375.375 0 0 0-.375-.375H15A1.125 1.125 0 0 1 13.875 9zm2.25 3.375H19.5a2.625 2.625 0 0 1 2.625 2.625v3a2.625 2.625 0 0 1-2.625 2.625h-3.375V19.5a2.625 2.625 0 0 1-2.625 2.625h-3A2.625 2.625 0 0 1 7.875 19.5v-3.375H4.5A2.625 2.625 0 0 1 1.875 13.5v-3A2.625 2.625 0 0 1 4.5 7.875h3.375V4.5A2.625 2.625 0 0 1 10.5 1.875h3A2.625 2.625 0 0 1 16.125 4.5z"
      />
    </svg>
  );
}
