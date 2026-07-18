import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { CardsStrip } from '../components/features/cards-strip'
import { BlogCard, CaseStudyCard, CustomerInterviewCard } from '../components/chat/entity-cards'
import { blogPostSummary, caseStudy, customerInterview } from './__fixtures__/chat-cards'

// All stories exercise the ORGANIC children mode: real entity cards passed as
// plain JSX children with zero strip-side registration. The render-prop mode
// is regression-tested by VideoBitesStrip.stories.tsx.
//
// Usage guidance: pass `autoScroll={false}` for chevron-style entity strips
// (Figma 3905:77388) — the engine default stays `true` for the bites
// marquee contract, so don't let the marquee-on default propagate silently.

const caseStudies = Array.from({ length: 7 }, (_, i) => ({
  ...caseStudy,
  id: i + 1,
  slug: `${caseStudy.slug}-${i}`,
  title: `${caseStudy.title} (${i + 1})`,
}))

const meta: Meta<typeof CardsStrip> = {
  title: 'Features/CardsStrip',
  component: CardsStrip,
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      <div className="bg-ods-bg p-8 min-h-[560px]">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof CardsStrip>

/** Figma 3905:77388: chevron-nav strip of uniform 400px case-study cards —
 *  `autoScroll={false}`, chevrons appear only when content overflows. */
export const CaseStudiesChevrons: Story = {
  render: () => (
    <CardsStrip title="Case Studies" autoScroll={false}>
      {caseStudies.map(study => (
        <CaseStudyCard key={study.slug} study={study} href={`/case-studies/${study.slug}`} />
      ))}
    </CardsStrip>
  ),
}

/** Any card type coexists with zero strip config — the managed cell's
 *  stretch keeps mixed card types row-aligned (verify heights match). */
export const MixedCardTypes: Story = {
  render: () => (
    <CardsStrip title="Latest Content" autoScroll={false}>
      <CaseStudyCard key="cs" study={caseStudy} href={`/case-studies/${caseStudy.slug}`} />
      <BlogCard key="blog" post={blogPostSummary} href={`/blog/${blogPostSummary.slug}`} />
      <CustomerInterviewCard
        key="interview"
        interview={customerInterview}
        href={`/interviews/${customerInterview.slug}`}
      />
      <CaseStudyCard key="cs2" study={caseStudies[1]} href={`/case-studies/${caseStudies[1].slug}`} />
      <BlogCard key="blog2" post={blogPostSummary} href={`/blog/${blogPostSummary.slug}-2`} />
    </CardsStrip>
  ),
}

/** Marquee opt-in (engine default). Accepted clone behaviors: the clone
 *  copy's inner cell is `aria-hidden` + focus-suppressed (every focusable
 *  descendant forced to `tabindex="-1"`) yet still pointer-CLICKABLE — a click
 *  on a visible clone opens its link, since the endless loop always paints
 *  clone cards in the viewport near the seam. The OUTER cell still hover-pauses
 *  the marquee; keyboard focus on original cards pauses too. */
export const MarqueeOptIn: Story = {
  render: () => (
    <CardsStrip title="Case Studies">
      {caseStudies.map(study => (
        <CaseStudyCard key={study.slug} study={study} href={`/case-studies/${study.slug}`} />
      ))}
    </CardsStrip>
  ),
}

/** Two cards — no overflow, so no clones, no marquee, no chevrons. */
export const TwoItemsNoOverflow: Story = {
  render: () => (
    <CardsStrip title="Case Studies" autoScroll={false}>
      {caseStudies.slice(0, 2).map(study => (
        <CaseStudyCard key={study.slug} study={study} href={`/case-studies/${study.slug}`} />
      ))}
    </CardsStrip>
  ),
}

/** Narrow cells via cardWidthDesktop/Mobile overrides. */
export const CustomCellWidth: Story = {
  render: () => (
    <CardsStrip title="Compact Row" autoScroll={false} cardWidthDesktop={320} cardWidthMobile={280}>
      {caseStudies.map(study => (
        <CaseStudyCard key={study.slug} study={study} href={`/case-studies/${study.slug}`} />
      ))}
    </CardsStrip>
  ),
}
