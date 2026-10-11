import type { SVGProps } from "react";
export interface CustomExternalLinkIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function CustomExternalLinkIcon({
    className = "",
    size = 24,
    color = '#888888',
    ...props
}: CustomExternalLinkIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 21 22"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                fill={color}
                d="M.375 17V5A4.125 4.125 0 0 1 4.5.875h3a1.125 1.125 0 1 1 0 2.25h-3c-1.036 0-1.875.84-1.875 1.875v12c0 1.036.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875v-3a1.125 1.125 0 0 1 2.25 0v3a4.125 4.125 0 0 1-4.125 4.125h-12A4.125 4.125 0 0 1 .375 17"
            />
            <path
                fill={color}
                d="m20.626 7.499-.006.116a1.126 1.126 0 0 1-2.239.001l-.006-.116-.002-2.789-8.078 8.085a1.125 1.125 0 0 1-1.59-1.59l8.077-8.084H14a1.125 1.125 0 0 1 0-2.25h5.498c.62 0 1.124.504 1.125 1.125z"
            />
        </svg>
    );
}
