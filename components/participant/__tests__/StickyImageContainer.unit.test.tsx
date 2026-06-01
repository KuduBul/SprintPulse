import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ParticipantForm, ParticipantFormProps } from '../ParticipantForm';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function createMockProps(overrides: Partial<ParticipantFormProps> = {}): ParticipantFormProps {
  return {
    poll: {
      id: 'poll-1',
      title: 'Test Poll',
      description: null,
      backgroundImageUrl: 'https://example.com/image.jpg',
      facilitatorState: {
        votingOpen: true,
        liveResults: false,
        anonymise: false,
        revealStage: 'none',
      },
      questions: [
        {
          id: 'q1',
          text: 'What is your favorite color?',
          options: ['Red', 'Blue', 'Green'],
          allowCustom: false,
          position: null,
          displayOrder: 1,
        },
      ],
    },
    facilitatorState: {
      votingOpen: true,
      liveResults: false,
      anonymise: false,
      revealStage: 'none',
    },
    onSubmit: vi.fn(),
    participantName: 'Test User',
    sessionToken: 'token-123',
    pollId: 'poll-1',
    isTestMode: true,
    ...overrides,
  };
}

// Force mobile viewport so ListLayout renders (width < 768)
function setMobileViewport() {
  Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
  window.dispatchEvent(new Event('resize'));
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('StickyImageContainer - Styling and Accessibility', () => {
  beforeEach(() => {
    setMobileViewport();
  });

  it('renders the sticky image container with role="img" and aria-label', () => {
    render(<ParticipantForm {...createMockProps()} />);

    const container = screen.getByRole('img', { name: 'Poll background image' });
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute('role', 'img');
    expect(container).toHaveAttribute('aria-label', 'Poll background image');
  });

  it('applies position: sticky and top: 0 on the container', () => {
    render(<ParticipantForm {...createMockProps()} />);

    const container = screen.getByRole('img', { name: 'Poll background image' });
    expect(container.style.position).toBe('sticky');
    expect(container.style.top).toBe('0px');
  });

  it('applies width: 100vw and edge-to-edge margin calculation on the container', () => {
    render(<ParticipantForm {...createMockProps()} />);

    const container = screen.getByRole('img', { name: 'Poll background image' });
    expect(container.style.width).toBe('100vw');
    expect(container.style.marginLeft).toBe('calc(50% - 50vw)');
  });

  it('applies aspectRatio: 16 / 9 and overflow: hidden on the container', () => {
    render(<ParticipantForm {...createMockProps()} />);

    const container = screen.getByRole('img', { name: 'Poll background image' });
    expect(container.style.aspectRatio).toBe('16 / 9');
    expect(container.style.overflow).toBe('hidden');
  });

  it('applies zIndex: 10 on the container', () => {
    render(<ParticipantForm {...createMockProps()} />);

    const container = screen.getByRole('img', { name: 'Poll background image' });
    expect(container.style.zIndex).toBe('10');
  });

  it('renders an img element with object-fit: cover inside the container', () => {
    render(<ParticipantForm {...createMockProps()} />);

    const container = screen.getByRole('img', { name: 'Poll background image' });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.style.objectFit).toBe('cover');
  });

  it('applies width: 100%, height: 100%, and display: block on the img element', () => {
    render(<ParticipantForm {...createMockProps()} />);

    const container = screen.getByRole('img', { name: 'Poll background image' });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.style.width).toBe('100%');
    expect(img!.style.height).toBe('100%');
    expect(img!.style.display).toBe('block');
  });

  it('sets alt="" on the img element for decorative image semantics', () => {
    render(<ParticipantForm {...createMockProps()} />);

    const container = screen.getByRole('img', { name: 'Poll background image' });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('alt')).toBe('');
  });

  it('sets the correct src on the img element', () => {
    render(<ParticipantForm {...createMockProps()} />);

    const container = screen.getByRole('img', { name: 'Poll background image' });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('https://example.com/image.jpg');
  });

  it('ensures z-index layering: container has higher z-index than question list items', () => {
    render(<ParticipantForm {...createMockProps()} />);

    const container = screen.getByRole('img', { name: 'Poll background image' });
    const containerZIndex = parseInt(container.style.zIndex, 10);

    // Question list items should not have a z-index higher than the sticky container
    const listItems = screen.getAllByRole('listitem');
    for (const item of listItems) {
      const itemZIndex = parseInt(item.style.zIndex || '0', 10);
      expect(containerZIndex).toBeGreaterThan(itemZIndex);
    }
  });
});
