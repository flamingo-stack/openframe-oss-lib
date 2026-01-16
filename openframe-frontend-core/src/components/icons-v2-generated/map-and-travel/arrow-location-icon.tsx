import type { SVGProps } from "react";
export interface ArrowLocationIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArrowLocationIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ArrowLocationIconProps) {
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
        d="M19.766.995c1.979-.628 3.867 1.26 3.24 3.239l-.072.198-6.998 17.379c-.721 1.792-3.236 1.718-3.902-.021l-.058-.174-2.05-6.983a.83.83 0 0 0-.56-.56l-6.982-2.05c-1.906-.559-2.046-3.215-.195-3.96l17.379-6.998zm.643 2.158L3.434 9.986 10 11.914A3.08 3.08 0 0 1 12.085 14l1.927 6.567 6.835-16.975.025-.102a.34.34 0 0 0-.362-.36z"
      />
    </svg>
  );
}
