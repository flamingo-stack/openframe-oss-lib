'use client';

import { Terminal, DollarSign, Network, Users } from 'lucide-react';
import type React from 'react';
import { SECTION_HEADING_CLASS } from './layout/page-heading';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => {
  return (
    <div className="flex h-full flex-col gap-6 rounded-3xl border border-ods-border bg-ods-card p-6 transition-colors duration-200 hover:bg-ods-bg-hover">
      {/* Icon Container */}
      <div className="flex h-12 w-12 items-center justify-center rounded border border-ods-border bg-ods-bg">
        <div className="h-6 w-6 text-ods-text-secondary">{icon}</div>
      </div>

      {/* Text Container */}
      <div className="flex flex-col gap-2">
        <h3 className="tracking-[-0.36px] text-ods-text-primary text-h3">{title}</h3>
        <p className="text-ods-text-primary text-h4">{description}</p>
      </div>
    </div>
  );
};

const OpenSourceFeatures: React.FC = () => {
  const features = [
    {
      icon: <Terminal className="h-6 w-6" />,
      title: 'Built on FOSS',
      description: 'No black boxes. No hidden fees. Just transparent, community-driven software you control.',
    },
    {
      icon: <DollarSign className="h-6 w-6" />,
      title: 'Own Your Stack',
      description: 'Replace overpriced, proprietary tools with open, auditable, and customizable components.',
    },
    {
      icon: <Network className="h-6 w-6" />,
      title: 'Modular by Design',
      description: 'Add, remove, or extend features with ease — OpenFrame adapts to how you work.',
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: 'Community-Powered',
      description:
        "Developed with and for MSPs by a global open-source community. You're not just a user — you're part of the roadmap.",
    },
  ];

  return (
    <section className="w-full bg-ods-bg py-12 md:py-16 lg:py-20">
      <div className="mx-auto w-full max-w-[1920px] px-6 md:px-20">
        {/* Section Title */}
        <div className="flex flex-col items-center gap-10">
          <h2 className={`${SECTION_HEADING_CLASS} w-full text-center`}>
            <span className="text-ods-accent">100%</span>
            <span> Open-Source. </span>
            <span className="text-ods-accent">0%</span>
            <span> Bullsh*t.</span>
          </h2>

          {/* Features Grid */}
          <div className="w-full">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => (
                <FeatureCard key={index} icon={feature.icon} title={feature.title} description={feature.description} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OpenSourceFeatures;
