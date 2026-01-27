import type { SVGProps } from "react";
export interface GenderMaleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GenderMaleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GenderMaleIconProps) {
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
        d="M15.674 20.997a2.137 2.137 0 0 1-2.145 2.128h-3.058a2.137 2.137 0 0 1-2.145-2.128V18.59l-.599-.39a2.13 2.13 0 0 1-.958-1.65l-.388-6.497a3.13 3.13 0 0 1 2.162-3.158l2.783-.914.166-.047a2.2 2.2 0 0 1 1.016 0l.166.047 2.783.914.248.092a3.13 3.13 0 0 1 1.918 2.8l-.004.266-.388 6.497a2.12 2.12 0 0 1-.757 1.5l-.201.15-.6.39v2.406Zm-5.098-.122h2.848v-2.352c0-.72.366-1.385.962-1.776l.602-.398.386-6.43-.005-.143a.89.89 0 0 0-.614-.743L12 8.13l-2.755.904a.884.884 0 0 0-.619.886l.384 6.43.604.398.212.16c.47.399.75.986.75 1.616v2.352Z"
      />
      <path
        fill={color}
        d="M13.374 4.5a1.375 1.375 0 1 0-2.75 0 1.375 1.375 0 0 0 2.75 0m2.25 0a3.624 3.624 0 1 1-7.248 0 3.624 3.624 0 0 1 7.248 0"
      />
    </svg>
  );
}
