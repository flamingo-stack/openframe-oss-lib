import type { SVGProps } from "react";
export interface GlobeIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function GlobeIcon({
    className = "",
    size = 24,
    color = 'white',
    ...props
}: GlobeIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <circle cx={12} cy={12} r={10} />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" />
        </svg>
    );
}
