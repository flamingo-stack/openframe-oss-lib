import type { SVGProps } from "react";
export interface GenderFemaleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GenderFemaleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GenderFemaleIconProps) {
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
        d="M15.723 20.997c0 1.211-1.007 2.128-2.165 2.128h-3.116c-1.158 0-2.164-.917-2.164-2.128v-1.69l-1.412-.455c-1.064-.343-1.722-1.454-1.418-2.574l2.064-7.574.059-.192a3.17 3.17 0 0 1 2.034-1.976l1.722-.555.165-.046a2.2 2.2 0 0 1 1.015 0l.166.046 1.723.555.187.066a3.16 3.16 0 0 1 1.904 2.102l2.064 7.574c.305 1.12-.352 2.231-1.416 2.574l-1.412.454v1.69Zm-5.195-.122h2.945v-1.664c0-.941.62-1.743 1.49-2.023l1.382-.447-2.029-7.445a.9.9 0 0 0-.496-.575l-.114-.044-1.707-.55-1.705.55a.92.92 0 0 0-.576.516l-.035.103-2.03 7.445 1.384.447a2.13 2.13 0 0 1 1.491 2.023z"
      />
      <path
        fill={color}
        d="M13.374 4.5a1.375 1.375 0 1 0-2.75 0 1.375 1.375 0 0 0 2.75 0m2.25 0a3.624 3.624 0 1 1-7.248 0 3.624 3.624 0 0 1 7.248 0"
      />
    </svg>
  );
}
