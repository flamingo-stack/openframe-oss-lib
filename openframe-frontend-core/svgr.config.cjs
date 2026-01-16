module.exports = {
  icon: true,
  typescript: true,
  ref: false,
  memo: false,
  titleProp: false,
  descProp: false,
  exportType: 'named',
  jsxRuntime: 'automatic',
  replaceAttrValues: {
    '#888': '{color}',
    '#888888': '{color}',
  },
  svgProps: {
    width: '{size}',
    height: '{size}',
    className: '{className}',
  },
  template: (variables, { tpl }) => {
    const componentName = variables.componentName;
    const propsInterface = `${componentName}Props`;

    return tpl`
import type { SVGProps } from 'react';

export interface ${propsInterface} extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  className?: string;
  size?: number;
  color?: string;
}

export function ${componentName}({
  className = '',
  size = 24,
  color = '#888888',
  ...props
}: ${propsInterface}) {
  return ${variables.jsx};
}
`;
  },
};
