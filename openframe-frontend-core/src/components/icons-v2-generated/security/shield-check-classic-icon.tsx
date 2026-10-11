import type { SVGProps } from "react";
export interface ShieldCheckClassicIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function ShieldCheckClassicIcon({
    className = "",
    size = 24,
    color = 'white',
    ...props
}: ShieldCheckClassicIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                stroke={color}
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 2 4 7v4c0 4.55 2.84 8.74 7 9.92 4.16-1.18 9-5.37 9-9.92V7z"
            />
            <path
                stroke={color}
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m9 12 2 2 4-4"
            />
        </svg>
    );
}
