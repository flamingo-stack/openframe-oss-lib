import type { SVGProps } from "react";
export interface FigmaClassicIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function FigmaClassicIcon({
    className = "",
    size = 24,
    color = "currentColor",
    ...props
}: FigmaClassicIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill={color}
            viewBox="0 0 256 256"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path d="M178.942 94A37.991 37.991 0 0 0 162 22.001H94a37.991 37.991 0 0 0-16.942 72 37.977 37.977 0 0 0 0 67.999A37.994 37.994 0 1 0 132 196v-44.718A37.984 37.984 0 1 0 178.942 94M192 60.001a30.033 30.033 0 0 1-29.98 30L162 90l-.039.001L132 90V30.001h30a30.034 30.034 0 0 1 30 30m-53.283 38a38.3 38.3 0 0 0-6.717 6.717V98ZM64 60a30.034 30.034 0 0 1 30-30h30V90H93.981A30.034 30.034 0 0 1 64 60.001m30 165.998A30 30 0 1 1 94 166h30v30a30.034 30.034 0 0 1-30 29.999m30-68L94 158a30 30 0 0 1-.019-60l.019.001h30Zm38 .001a30 30 0 0 1-.039-59.999h.058A30 30 0 0 1 162 158" />
        </svg>
    );
}
