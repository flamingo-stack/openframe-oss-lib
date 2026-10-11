import type { SVGProps } from "react";
export interface ThumbsUpClassicIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function ThumbsUpClassicIcon({
    className = "",
    size = 24,
    color = '#F357BB',
    ...props
}: ThumbsUpClassicIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 23 23"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                fill={color}
                d="M5 21.126V9.625a1.125 1.125 0 0 1 2.25 0v11.5a1.125 1.125 0 0 1-2.25 0"
            />
            <path
                fill={color}
                d="M12 3.625c0-.759-.616-1.375-1.376-1.375h-.246l-3.213 7.803a1.125 1.125 0 0 1-1.04.697h-2c-1.036 0-1.875.84-1.875 1.876v5.499C2.25 19.16 3.09 20 4.125 20h12.926c.925 0 1.712-.675 1.853-1.59l1.078-7a1.876 1.876 0 0 0-1.855-2.16h-5.002A1.125 1.125 0 0 1 12 8.125zM14.25 7h3.877a4.126 4.126 0 0 1 4.108 4.518l-.03.234-1.076 7a4.126 4.126 0 0 1-4.078 3.498H4.125A4.125 4.125 0 0 1 0 18.125v-5.5A4.125 4.125 0 0 1 4.125 8.5h1.247l2.957-7.185.067-.145A2.13 2.13 0 0 1 10.295 0h.33a3.626 3.626 0 0 1 3.625 3.625z"
            />
        </svg>
    );
}
