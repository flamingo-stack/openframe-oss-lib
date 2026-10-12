import { useId, type SVGProps } from "react";
export interface ClickupIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ClickupIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ClickupIconProps) {
  // Per-instance ids: see scopeIds in scripts/generate-icons.mjs.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 54.8 65.8"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${uid}clickup_svg__a`}
          x1={0}
          x2={54.845}
          y1={15.049}
          y2={15.049}
          gradientTransform="matrix(1 0 0 -1 0 69.36)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset={0} stopColor="#8930FD" />
          <stop offset={1} stopColor="#49CCF9" />
        </linearGradient>
        <linearGradient
          id={`${uid}clickup_svg__b`}
          x1={1.195}
          x2={53.745}
          y1={53.166}
          y2={53.166}
          gradientTransform="matrix(1 0 0 -1 0 69.36)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset={0} stopColor="#FF02F0" />
          <stop offset={1} stopColor="#FFC800" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${uid}clickup_svg__a)`}
        fillRule="evenodd"
        d="m0 50.6 10.1-7.8c5.4 7 11.1 10.3 17.4 10.3s11.9-3.2 17-10.2l10.3 7.6c-7.4 10-16.6 15.3-27.3 15.3-10.6 0-19.9-5.3-27.5-15.2"
        clipRule="evenodd"
      />
      <path
        fill={`url(#${uid}clickup_svg__b)`}
        fillRule="evenodd"
        d="m27.5 16.9-18 15.5-8.3-9.7L27.6 0l26.2 22.7-8.4 9.6z"
        clipRule="evenodd"
      />
    </svg>
  );
}
