import type { SVGProps } from "react";
export interface TransparentTrustedIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function TransparentTrustedIcon({
    className = "",
    size = 24,
    color = '#F357BB',
    ...props
}: TransparentTrustedIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 42 42"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                stroke={color}
                d="M1 23h7.181c1.127 0 2.248.158 3.33.47l6.281 1.815a8 8 0 0 0 2.22.314h4.568a3.3 3.3 0 0 1 1.216 6.37m-24.761 3.03h2.86a4 4 0 0 1 1.912.487l7.21 3.923a13 13 0 0 0 10.647.802l15.033-5.454a3.5 3.5 0 1 0-2.388-6.58L25.796 31.97m-8.916.231h7.7a3.3 3.3 0 0 0 1.022-.161m.194-.07-.194.07m.194-.07a3 3 0 0 1-.194.07M41.004 18.99h-7.181c-1.127 0-2.248-.16-3.331-.472l-6.28-1.814a8 8 0 0 0-2.22-.314h-4.568a3.3 3.3 0 0 1-1.216-6.37m24.761-3.03h-2.86a4 4 0 0 1-1.912-.487l-7.21-3.923a13 13 0 0 0-10.647-.802L3.307 7.233a3.5 3.5 0 1 0 2.388 6.58l10.513-3.792m8.916-.23h-7.7q-.537.002-1.022.16m-.194.07.194-.07m-.194.07q.096-.037.194-.07"
            />
        </svg>
    );
}
