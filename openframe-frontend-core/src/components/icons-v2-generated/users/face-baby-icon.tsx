import type { SVGProps } from "react";
export interface FaceBabyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FaceBabyIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FaceBabyIconProps) {
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
        d="M14.324 16.104a1.125 1.125 0 0 1 1.352 1.8A6.1 6.1 0 0 1 12 19.127a6.1 6.1 0 0 1-3.28-.95l-.395-.275-.088-.073a1.125 1.125 0 0 1 1.344-1.79l.096.064.25.173c.599.381 1.31.6 2.073.6.874 0 1.678-.286 2.325-.773Zm-6.45-3.646a1.126 1.126 0 0 1-1.749-1.416l1.75 1.416Zm-1.749-1.416c1.265-1.56 3.485-1.56 4.75 0a1.126 1.126 0 0 1-1.75 1.416c-.364-.448-.886-.448-1.25 0L7 11.75zm8.748 1.416a1.125 1.125 0 1 1-1.747-1.416zm-1.747-1.416c1.265-1.56 3.483-1.56 4.748 0a1.125 1.125 0 1 1-1.748 1.416c-.364-.449-.888-.449-1.253 0l-.872-.709z"
      />
      <path
        fill={color}
        d="M8.375 4.5q.002-.322.057-.628a8.877 8.877 0 0 0 3.569 17.003 8.875 8.875 0 0 0 0-17.75 1.376 1.376 0 1 0 1.1 2.2 1.125 1.125 0 1 1 1.798 1.35A3.625 3.625 0 0 1 8.375 4.5m14.75 7.5c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875l.57.015c5.88.297 10.554 5.158 10.554 11.11"
      />
    </svg>
  );
}
