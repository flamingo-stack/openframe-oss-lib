'use client'

import React from 'react'
import { BenefitCard, BenefitCardGrid } from '../ui'
import {
  G2Icon,
  CapterraIcon,
  TrustpilotIcon,
  GetAppIcon,
} from '../icons'
import {
  ContactForm,
  type ContactFormProps,
} from '../contact'

/**
 * `<ShareExperienceSection>` — the case-studies "Share Your Experience"
 * CTA block.
 *
 * Hub usage: rendered inside the unified case-studies chrome (between
 * the search bar and the case-study card grid) so it stays at the same
 * y-offset + gutters as the rest of the page content.
 *
 * Embedders mount this anywhere they like. The inner `<ContactForm>`
 * submits through the AMBIENT `EndpointsRuntime.contactUrl` (same proxy
 * seam every other embed-aware form uses), so embedders behind a
 * `/content` reverse proxy get a working submission with no per-call-
 * site wiring.
 *
 * **Copy is overridable.** Every string is a prop with a sensible
 * "Flamingo case-studies" default so the hub keeps its existing copy
 * verbatim; embedders override what they need.
 *
 * **Contact-form integration is configurable.** Hub auto-resolves
 * `userId` / `helpCategoryOptions` / `rdtCid` / `onSubmitSuccess` from
 * its app context and passes them down via `contactFormProps`;
 * embedders without that context just omit them. All other
 * `ContactFormProps` are forwarded too, so the host can adjust prefill,
 * success redirect, hidden fields, etc. without forking this component.
 */
export interface ShareExperienceSectionProps {
  /** Override the section heading. JSX so the host can break lines /
   *  colorize the accent the same way the hub does. Default: the
   *  hub's two-line "Share Your Experience / with Fellow MSPs:" copy. */
  title?: React.ReactNode
  /** Override the lead paragraph. Default: the hub's review-incentive
   *  copy referencing Flamingo. Pass a brand-neutral string in embeds. */
  subtitle?: React.ReactNode
  /** Override the "How it works?" sub-heading. */
  howItWorksTitle?: React.ReactNode
  /** Override the "How it works?" body copy. */
  howItWorksBody?: React.ReactNode
  /** Forwarded to the inner `<ContactForm>`. The hub passes its
   *  auto-resolved `userId` / `helpCategoryOptions` / `rdtCid` /
   *  `onSubmitSuccess` here. Embedders pass overrides like
   *  `successRedirectUrl` or extra prefill copy. */
  contactFormProps?: Partial<ContactFormProps>
  className?: string
}

const DEFAULT_TITLE: React.ReactNode = (
  <>
    Share Your Experience
    <br />
    with Fellow MSPs<span className="text-ods-accent">:</span>
  </>
)

const DEFAULT_SUBTITLE: React.ReactNode = (
  <>
    We know your time is valuable. When you leave an honest review about
    your Flamingo experience, we&apos;d like to thank you with a gift
    certificate – not as payment for a review, but as appreciation for
    the time you invest in helping other MSPs make informed decisions.
  </>
)

const DEFAULT_HOW_IT_WORKS_TITLE: React.ReactNode = (
  <>
    How it works<span className="text-ods-accent">?</span>
  </>
)

const DEFAULT_HOW_IT_WORKS_BODY: React.ReactNode = (
  <>
    Share your name and email with us, and we&apos;ll reach out to guide
    you through the review process and arrange your thank-you gift
    certificate.
  </>
)

/** Defaults that match the hub's existing /case-studies behavior. Host
 *  overrides via `contactFormProps` win over these. */
const DEFAULT_CONTACT_FORM_PROPS = {
  prefilledReason: 'I want to do a case study',
  prefilledMessage: 'I want to do a case study',
  hideFields: ['companySize', 'referralSource', 'helpCategory', 'message'] as ContactFormProps['hideFields'],
  title: '',
  subtitle: '',
  footerText: '',
  noBorder: true,
  noPadding: true,
  buttonVariant: 'outline' as ContactFormProps['buttonVariant'],
  buttonClassName: 'w-full',
  successToastMessage: "Thank you! We'll reach out to schedule your case study.",
} satisfies Partial<ContactFormProps>

export function ShareExperienceSection({
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  howItWorksTitle = DEFAULT_HOW_IT_WORKS_TITLE,
  howItWorksBody = DEFAULT_HOW_IT_WORKS_BODY,
  contactFormProps,
  className,
}: ShareExperienceSectionProps = {}) {
  return (
    <section className={`flex flex-col gap-10${className ? ` ${className}` : ''}`}>
      <div className="text-ods-text-primary">
        <h2 className="text-h1 text-ods-text-primary">{title}</h2>
        <p className="text-h4 mt-6 max-w-[765px]">{subtitle}</p>
      </div>

      <div className="bg-ods-bg border border-ods-border rounded-md p-10">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-6 text-ods-text-primary">
            <h3 className="text-h2">{howItWorksTitle}</h3>
            <p className="text-h4">{howItWorksBody}</p>
          </div>

          <BenefitCardGrid columns={4}>
            <BenefitCard
              icon={
                <div className="bg-ods-bg border border-ods-border rounded-md p-2 w-12 h-12 flex items-center justify-center">
                  <G2Icon width={24} height={24} />
                </div>
              }
              title="G2"
              description="g2.com"
              variant="auth-figma"
            />
            <BenefitCard
              icon={
                <div className="bg-ods-bg border border-ods-border rounded-md p-2 w-12 h-12 flex items-center justify-center">
                  <CapterraIcon width={24} height={24} />
                </div>
              }
              title="Capterra"
              description="capterra.com"
              variant="auth-figma"
            />
            <BenefitCard
              icon={
                <div className="bg-ods-bg border border-ods-border rounded-md p-2 w-12 h-12 flex items-center justify-center">
                  <TrustpilotIcon width={24} height={24} />
                </div>
              }
              title="TrustPilot"
              description="trustpilot.com"
              variant="auth-figma"
            />
            <BenefitCard
              icon={
                <div className="bg-ods-bg border border-ods-border rounded-md p-2 w-12 h-12 flex items-center justify-center">
                  <GetAppIcon width={24} height={24} />
                </div>
              }
              title="GetApp"
              description="getapp.com"
              variant="auth-figma"
            />
          </BenefitCardGrid>

          {/* Submission proxies through ambient EndpointsRuntime.contactUrl —
           *  no per-call-site wiring needed for embeds behind a reverse
           *  proxy. Hub's auto-resolving wrapper passes userId / rdtCid /
           *  onSubmitSuccess via `contactFormProps`. */}
          <ContactForm
            {...DEFAULT_CONTACT_FORM_PROPS}
            {...contactFormProps}
          />
        </div>
      </div>
    </section>
  )
}
