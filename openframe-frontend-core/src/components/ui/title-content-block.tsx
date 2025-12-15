'use client';

import React from 'react';

export interface TitleContentBlockProps {
  title: string;
  content: React.ReactNode;
  titleColor?: string;
  titleClassName?: string;
  contentClassName?: string;
  containerClassName?: string;
  titleAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div';
  contentAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'div';
  spacing?: 'sm' | 'md' | 'lg';
}

const spacingMap = {
  sm: 'space-y-1',
  md: 'space-y-2',
  lg: 'space-y-4'
};

export function TitleContentBlock({
  title,
  content,
  titleColor = 'text-ods-text-secondary',
  titleClassName = "font-['Azeret_Mono'] font-medium text-[14px] tracking-[-0.28px] uppercase leading-[20px]",
  contentClassName = "font-['Azeret_Mono'] font-semibold text-[28px] md:text-[32px] leading-[1.25] tracking-[-0.64px] text-ods-text-primary",
  containerClassName = '',
  titleAs: TitleElement = 'div',
  contentAs: ContentElement = 'h4',
  spacing = 'md'
}: TitleContentBlockProps) {
  const titleClasses = `${titleClassName} ${titleColor}`;
  
  return (
    <div className={`${spacingMap[spacing]} ${containerClassName}`}>
      <TitleElement className={titleClasses}>
        {title}
      </TitleElement>
      <ContentElement className={contentClassName}>
        {content}
      </ContentElement>
    </div>
  );
}