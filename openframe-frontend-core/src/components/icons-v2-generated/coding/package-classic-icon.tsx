import type { SVGProps } from "react";
export interface PackageClassicIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function PackageClassicIcon({
    className = "",
    size = 24,
    color = 'white',
    ...props
}: PackageClassicIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill={color}
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
                strokeWidth={2}
                d="m21 8-9 5-9-5M21 16l-9 5-9-5"
            />
            <path
                stroke={color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="m3 8 9-5 9 5v8l-9 5-9-5z"
            />
        </svg>
    );
}
