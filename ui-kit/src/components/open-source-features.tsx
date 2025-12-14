import React from 'react';
import { Terminal, DollarSign, Network, Users } from 'lucide-react';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => {
  return (
    <div className="bg-ods-card border border-ods-border rounded-3xl p-6 flex flex-col gap-6 h-full hover:bg-[#252525] transition-colors duration-200">
      {/* Icon Container */}
      <div className="w-12 h-12 bg-[#161616] border border-ods-border rounded flex items-center justify-center">
        <div className="w-6 h-6 text-ods-text-secondary">
          {icon}
        </div>
      </div>
      
      {/* Text Container */}
      <div className="flex flex-col gap-2">
        <h3 className="font-['DM_Sans'] font-bold text-[18px] leading-[24px] text-ods-text-primary tracking-[-0.36px]">
          {title}
        </h3>
        <p className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-ods-text-primary">
          {description}
        </p>
      </div>
    </div>
  );
};

const OpenSourceFeatures: React.FC = () => {
  const features = [
    {
      icon: <Terminal className="w-6 h-6" />,
      title: "Built on FOSS",
      description: "No black boxes. No hidden fees. Just transparent, community-driven software you control."
    },
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: "Own Your Stack",
      description: "Replace overpriced, proprietary tools with open, auditable, and customizable components."
    },
    {
      icon: <Network className="w-6 h-6" />,
      title: "Modular by Design",
      description: "Add, remove, or extend features with ease — OpenFrame adapts to how you work."
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Community-Powered",
      description: "Developed with and for MSPs by a global open-source community. You're not just a user — you're part of the roadmap."
    }
  ];

  return (
    <section className="w-full bg-[#161616] py-12 sm:py-16 lg:py-20">
      <div className="w-full max-w-[1920px] mx-auto px-6 md:px-20">
        {/* Section Title */}
        <div className="flex flex-col items-center gap-10">
          <h2 className="font-['Azeret_Mono'] font-semibold text-3xl sm:text-4xl lg:text-5xl xl:text-[56px] leading-tight text-center tracking-[-0.02em] text-ods-text-primary w-full">
            <span className="text-ods-accent">100%</span>
            <span> Open-Source. </span>
            <span className="text-ods-accent">0%</span>
            <span> Bullsh*t.</span>
          </h2>
          
          {/* Features Grid */}
          <div className="w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <FeatureCard
                  key={index}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OpenSourceFeatures; 