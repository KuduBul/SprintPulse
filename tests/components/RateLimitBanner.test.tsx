import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { RateLimitBanner } from '@/components/error/RateLimitBanner';

describe('RateLimitBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when not rate limited', () => {
    const { container } = render(
      <RateLimitBanner isRateLimited={false} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders banner when rate limited', () => {
    render(
      <RateLimitBanner isRateLimited={true} retryAfterSeconds={30} />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Too many requests.')).toBeInTheDocument();
  });

  it('shows countdown timer', () => {
    render(
      <RateLimitBanner isRateLimited={true} retryAfterSeconds={30} />
    );

    expect(screen.getByText('30s')).toBeInTheDocument();
  });

  it('counts down every second', () => {
    render(
      <RateLimitBanner isRateLimited={true} retryAfterSeconds={5} />
    );

    expect(screen.getByText('5s')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('4s')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('3s')).toBeInTheDocument();
  });

  it('calls onCountdownComplete when countdown reaches zero', () => {
    const onComplete = vi.fn();
    render(
      <RateLimitBanner
        isRateLimited={true}
        retryAfterSeconds={3}
        onCountdownComplete={onComplete}
      />
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('has polite aria-live for non-urgent announcement', () => {
    render(
      <RateLimitBanner isRateLimited={true} retryAfterSeconds={30} />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');
  });

  it('uses default 60 seconds when retryAfterSeconds not provided', () => {
    render(
      <RateLimitBanner isRateLimited={true} />
    );

    expect(screen.getByText('60s')).toBeInTheDocument();
  });
});
