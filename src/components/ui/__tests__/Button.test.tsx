import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button onClick={handleClick} disabled>
        Click me
      </Button>
    );

    await user.click(screen.getByRole('button'));

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should render with default variant', () => {
    const { container } = render(<Button>Default</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-primary');
  });

  it('should render with destructive variant', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-destructive');
  });

  it('should render with outline variant', () => {
    const { container } = render(<Button variant="outline">Outline</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('border');
  });

  it('should render with secondary variant', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-secondary');
  });

  it('should render with ghost variant', () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toMatch(/hover:bg-accent/);
  });

  it('should render with link variant', () => {
    const { container } = render(<Button variant="link">Link</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('underline-offset-4');
  });

  it('should render with small size', () => {
    const { container } = render(<Button size="sm">Small</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('h-9');
  });

  it('should render with large size', () => {
    const { container } = render(<Button size="lg">Large</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('h-11');
  });

  it('should render with icon size', () => {
    const { container } = render(<Button size="icon">Icon</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('h-10');
    expect(button?.className).toContain('w-10');
  });

  it('should apply custom className', () => {
    const { container } = render(<Button className="custom-class">Custom</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('custom-class');
  });

  it('should handle keyboard events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Press Enter</Button>);

    const button = screen.getByRole('button');
    button.focus();
    await user.keyboard('{Enter}');

    expect(handleClick).toHaveBeenCalled();
  });

  it('should handle space key', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Press Space</Button>);

    const button = screen.getByRole('button');
    button.focus();
    await user.keyboard(' ');

    expect(handleClick).toHaveBeenCalled();
  });

  it('should not trigger onClick when disabled via keyboard', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button onClick={handleClick} disabled>
        Disabled
      </Button>
    );

    const button = screen.getByRole('button');
    button.focus();
    await user.keyboard('{Enter}');

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should render with loading state', () => {
    render(<Button disabled>Loading...</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Ref Button</Button>);
    expect(ref).toHaveBeenCalled();
  });
});
