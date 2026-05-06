import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConnectionBanner } from '@/components/error/ConnectionBanner';

describe('ConnectionBanner', () => {
  it('renders nothing when not disconnected', () => {
    const { container } = render(
      <ConnectionBanner isDisconnected={false} onRetry={() => {}} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders banner when disconnected', () => {
    render(
      <ConnectionBanner isDisconnected={true} onRetry={() => {}} />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Connection lost. Please check your network.')).toBeInTheDocument();
  });

  it('shows retry button', () => {
    render(
      <ConnectionBanner isDisconnected={true} onRetry={() => {}} />
    );

    expect(screen.getByText('Retry now')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(
      <ConnectionBanner isDisconnected={true} onRetry={onRetry} />
    );

    fireEvent.click(screen.getByText('Retry now'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows "Retrying..." when isRetrying is true', () => {
    render(
      <ConnectionBanner isDisconnected={true} onRetry={() => {}} isRetrying={true} />
    );

    expect(screen.getByText('Retrying...')).toBeInTheDocument();
    expect(screen.queryByText('Retry now')).not.toBeInTheDocument();
  });

  it('disables retry button when retrying', () => {
    render(
      <ConnectionBanner isDisconnected={true} onRetry={() => {}} isRetrying={true} />
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('shows next retry delay when provided', () => {
    render(
      <ConnectionBanner
        isDisconnected={true}
        onRetry={() => {}}
        nextRetryMs={4000}
      />
    );

    expect(screen.getByText('(retrying in 4s)')).toBeInTheDocument();
  });

  it('does not show retry delay when retrying', () => {
    render(
      <ConnectionBanner
        isDisconnected={true}
        onRetry={() => {}}
        isRetrying={true}
        nextRetryMs={4000}
      />
    );

    expect(screen.queryByText(/retrying in/)).not.toBeInTheDocument();
  });

  it('has assertive aria-live for immediate announcement', () => {
    render(
      <ConnectionBanner isDisconnected={true} onRetry={() => {}} />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });
});
