import type { SVGProps } from "react";
export interface NaturalLanguageIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function NaturalLanguageIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: NaturalLanguageIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 90 90"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        stroke="var(--ods-open-yellow-base)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M29 65v-7.619c0-4.762-4-6.476-4-14.381 0-10.476 7.524-18 18-18 8.493 0 14.782 6.259 16.86 14.21.965 3.698 1.835 7.5 3.895 10.719l.827 1.293c1.085 1.695-.05 3.932-2.059 4.058l-1.836.114a2 2 0 0 0-1.864 1.787l-.446 4.238A4 4 0 0 1 54.399 65H49a6 6 0 0 1-6-6"
      />
    </svg>
  );
}
