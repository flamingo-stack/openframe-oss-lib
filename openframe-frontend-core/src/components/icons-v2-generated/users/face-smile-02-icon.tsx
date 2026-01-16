import type { SVGProps } from "react";
export interface FaceSmile02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FaceSmile02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FaceSmile02IconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M15.1 14.324a1.125 1.125 0 0 1 1.8 1.352 6.12 6.12 0 0 1-4.9 2.45 6.12 6.12 0 0 1-4.899-2.45l.9-.675.899-.677a3.87 3.87 0 0 0 3.1 1.551 3.87 3.87 0 0 0 3.1-1.55Zm-7.776-.223a1.126 1.126 0 0 1 1.576.223l-1.8 1.352a1.125 1.125 0 0 1 .223-1.575Zm.55-3.643a1.126 1.126 0 0 1-1.749-1.416l1.75 1.416ZM6.126 9.042c1.265-1.56 3.485-1.56 4.75 0a1.125 1.125 0 0 1-1.75 1.416c-.364-.449-.886-.449-1.25 0L7 9.75l-.875-.707Zm8.748 1.416a1.125 1.125 0 1 1-1.747-1.416zm-1.747-1.416c1.265-1.56 3.483-1.56 4.748 0a1.125 1.125 0 1 1-1.748 1.416c-.364-.449-.888-.449-1.253 0l-.872-.709z"
      />
    </svg>
  );
}
