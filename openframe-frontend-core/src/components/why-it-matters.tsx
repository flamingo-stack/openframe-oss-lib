'use client';

import type React from 'react';
import { SECTION_HEADING_CLASS } from './layout/page-heading';

interface WhyItMattersItemProps {
  number: string;
  title: string;
  description: string;
  isLast?: boolean;
}

const WhyItMattersItem: React.FC<WhyItMattersItemProps> = ({ number, title, description, isLast }) => {
  return (
    <li
      className={`flex w-full flex-col items-start gap-6 p-10 transition-colors duration-200 hover:bg-ods-bg-hover md:flex-row ${!isLast ? 'border-b border-ods-border' : ''} `}
    >
      <span className="tracking-[-0.02em] text-ods-accent text-h2">{number}</span>
      <div className="flex-1">
        <h3 className="tracking-[-0.02em] text-ods-text-primary text-h2">{title}</h3>
        <p className="mt-4 text-ods-text-primary text-h4">{description}</p>
      </div>
    </li>
  );
};

const WhyItMatters = () => {
  const items = [
    {
      number: '1.',
      title: 'Cut Costs',
      description: 'Eliminate vendor fees with proven open-source alternatives',
    },
    {
      number: '2.',
      title: 'Stay in Control',
      description: 'Full visibility and data ownership',
    },
    {
      number: '3.',
      title: 'Build What You Need',
      description: 'Customize without vendor limitations',
    },
    {
      number: '4.',
      title: 'Scale Freely',
      description: 'Designed for multi-tenant MSP environments',
    },
  ];

  return (
    <section className="bg-ods-bg">
      <div className="mx-auto w-full max-w-[1920px] px-6 md:px-20">
        <h2 className={`${SECTION_HEADING_CLASS} mb-6 text-center`}>Why It Matters</h2>
        <div className="w-full overflow-hidden rounded-3xl border border-ods-border bg-ods-card">
          <ol>
            {items.map((item, index) => (
              <WhyItMattersItem
                key={item.number}
                number={item.number}
                title={item.title}
                description={item.description}
                isLast={index === items.length - 1}
              />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
};

export default WhyItMatters;
