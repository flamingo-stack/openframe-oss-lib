import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingCarousel } from '../onboarding-carousel';

const STEPS = [
  { id: 'a', icon: null, title: 'First' },
  { id: 'b', icon: null, title: 'Second' },
  { id: 'c', icon: null, title: 'Third' },
];

const currentSlide = () =>
  screen.getAllByRole('group', { hidden: true }).find(el => el.getAttribute('aria-hidden') === 'false');

describe('OnboardingCarousel', () => {
  it('starts on the first step with Previous disabled', () => {
    render(<OnboardingCarousel steps={STEPS} onComplete={vi.fn()} />);
    expect(currentSlide()).toHaveTextContent('First');
    expect(screen.getByRole('button', { name: 'Previous Step' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Next Step' })).toBeEnabled();
  });

  it('walks forward and back', () => {
    render(<OnboardingCarousel steps={STEPS} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next Step' }));
    expect(currentSlide()).toHaveTextContent('Second');
    fireEvent.click(screen.getByRole('button', { name: 'Previous Step' }));
    expect(currentSlide()).toHaveTextContent('First');
    expect(screen.getByText('Step 1 of 3: First')).toHaveAttribute('aria-live', 'polite');
  });

  it('swaps Next for the complete action on the last step', () => {
    const onComplete = vi.fn();
    render(<OnboardingCarousel steps={STEPS} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3' }));
    expect(screen.queryByRole('button', { name: 'Next Step' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start Chat' }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('follows the arrow keys and stops at the ends', () => {
    render(<OnboardingCarousel steps={STEPS} onComplete={vi.fn()} />);
    const region = screen.getByRole('region', { name: 'Introduction' });
    fireEvent.keyDown(region, { key: 'ArrowLeft' });
    expect(currentSlide()).toHaveTextContent('First');
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(currentSlide()).toHaveTextContent('Third');
  });

  it('marks the current dot', () => {
    render(<OnboardingCarousel steps={STEPS} onComplete={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Go to step 1' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: 'Go to step 2' })).not.toHaveAttribute('aria-current');
  });
});
