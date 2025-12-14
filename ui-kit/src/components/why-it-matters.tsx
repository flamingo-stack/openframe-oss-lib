import React from 'react';

interface WhyItMattersItemProps {
  number: string;
  title: string;
  description: string;
  isLast?: boolean;
}

const WhyItMattersItem: React.FC<WhyItMattersItemProps> = ({ number, title, description, isLast }) => {
  return (
    <li
      className={`
        flex flex-col md:flex-row items-start gap-6 p-10 w-full
        transition-colors duration-200 hover:bg-[#2A2A2A]
        ${!isLast ? 'border-b border-ods-border' : ''}
      `}
    >
      <span className="font-['Azeret_Mono'] text-[32px] font-semibold leading-[1.25em] tracking-[-0.02em] text-ods-accent">
        {number}
      </span>
      <div className="flex-1">
        <h3 className="font-['Azeret_Mono'] text-[32px] font-semibold leading-[1.25em] tracking-[-0.02em] text-ods-text-primary">
          {title}
        </h3>
        <p className="font-['DM_Sans'] text-lg font-medium leading-[1.33em] text-ods-text-primary mt-4">
          {description}
        </p>
      </div>
    </li>
  );
};


const WhyItMatters = () => {
  const items = [
    {
      number: "1.",
      title: "Cut Costs",
      description: "Eliminate vendor fees with proven open-source alternatives",
    },
    {
      number: "2.",
      title: "Stay in Control",
      description: "Full visibility and data ownership",
    },
    {
      number: "3.",
      title: "Build What You Need",
      description: "Customize without vendor limitations",
    },
    {
      number: "4.",
      title: "Scale Freely",
      description: "Designed for multi-tenant MSP environments",
    },
  ];

  return (
    <section className="bg-[#161616]">
      <div className="w-full max-w-[1920px] mx-auto px-6 md:px-20">
        <h2 className="font-['Azeret_Mono'] text-center text-[32px] sm:text-[40px] lg:text-[56px] font-semibold text-ods-text-primary leading-[1.14em] tracking-[-0.02em] mb-6">
          Why It Matters
        </h2>
        <div className="bg-ods-card border border-ods-border rounded-3xl overflow-hidden w-full">
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