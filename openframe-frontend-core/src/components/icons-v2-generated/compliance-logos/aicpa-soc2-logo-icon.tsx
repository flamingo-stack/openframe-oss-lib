import type { SVGProps } from "react";
export interface AicpaSoc2LogoIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function AicpaSoc2LogoIcon({
    className = "",
    size = 24,
    color = "currentColor",
    ...props
}: AicpaSoc2LogoIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 400 400"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <defs>
                <path
                    id="aicpa-soc2-logo_svg__a"
                    d="M47.41 248.11a160 160 0 1 1 305.18 0"
                />
                <path
                    id="aicpa-soc2-logo_svg__b"
                    d="M24.52 255.33a184 184 0 0 0 350.96 0"
                />
            </defs>
            <circle cx={200} cy={200} r={199} fill="#FFF" />
            <circle cx={200} cy={200} r={196} fill="#0177C1" />
            <path
                fill="#111"
                d="M13.07 258.94a196 196 0 0 0 373.86 0l-45.78-14.44a148 148 0 0 1-282.3 0Z"
            />
            <circle cx={200} cy={200} r={148} fill="#FFF" />
            <text
                fill="#FFF"
                fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
                fontSize={24}
            >
                <textPath
                    href="#aicpa-soc2-logo_svg__a"
                    startOffset="50%"
                    textAnchor="middle"
                >
                    {"AICPA Service Organization Control Reports"}
                </textPath>
            </text>
            <text
                fill="#FFF"
                fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
                fontSize={27}
                fontWeight={700}
            >
                <textPath
                    href="#aicpa-soc2-logo_svg__b"
                    startOffset="50%"
                    textAnchor="middle"
                >
                    {"Formerly SAS 70 Reports"}
                </textPath>
            </text>
            <text
                x={200}
                y={172}
                fill="#0177C1"
                fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
                fontSize={67}
                fontWeight={300}
                lengthAdjust="spacingAndGlyphs"
                textAnchor="middle"
                textLength={279}
            >
                {"AICPA"}
            </text>
            <path stroke="#C6C6C6" strokeWidth={1.5} d="M102 194.5h194" />
            <text
                x={200}
                y={272}
                fill="#111"
                fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
                fontSize={78}
                fontWeight={500}
                lengthAdjust="spacingAndGlyphs"
                textAnchor="middle"
                textLength={218}
            >
                {"SOC 2"}
            </text>
        </svg>
    );
}
