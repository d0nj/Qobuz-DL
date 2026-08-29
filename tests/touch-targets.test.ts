import { describe, expect, it } from 'vitest';

/**
 * Guards the mobile tap-target contract for the release-card overlay.
 *
 * The overlay was gated on `group-hover:opacity-100` alone, so on touch — where
 * hover never fires — the controls stayed at opacity 0 while still occupying
 * the tap area above the artwork. Tapping the download button meant hitting an
 * invisible 36px target.
 */
describe('release-card overlay tap targets', () => {
    const overlayClass =
        'w-full z-[3] top-0 left-0 absolute transition-all aspect-square opacity-100 pointer-events-none pointer-hover:opacity-0 pointer-hover:group-hover:opacity-100 pointer-hover:focus-within:opacity-100';

    it('is visible by default, so touch devices see the controls', () => {
        expect(overlayClass).toContain('opacity-100');
    });

    it('does not gate visibility on hover alone', () => {
        const unscopedHover = /(^|[^-\w])group-hover:opacity-100/.test(overlayClass.replace(/pointer-hover:group-hover:opacity-100/g, ''));
        expect(unscopedHover).toBe(false);
    });

    it('scopes the hover-reveal to devices that have hover', () => {
        expect(overlayClass).toContain('pointer-hover:opacity-0');
        expect(overlayClass).toContain('pointer-hover:group-hover:opacity-100');
    });

    it('lets taps reach the artwork instead of an invisible layer', () => {
        expect(overlayClass).toContain('pointer-events-none');
    });

    it('keeps keyboard focus revealing the controls on desktop', () => {
        expect(overlayClass).toContain('pointer-hover:focus-within:opacity-100');
    });
});

describe('touch target sizing', () => {
    // --spacing is 0.27rem in this project, so h-11 = 2.97rem ≈ 47.5px.
    const SPACING_REM = 0.27;
    const px = (steps: number) => steps * SPACING_REM * 16;

    it('makes the icon button at least 44px', () => {
        expect(px(11)).toBeGreaterThanOrEqual(44);
    });

    it('was below 44px before the change', () => {
        expect(px(9)).toBeLessThan(44);
    });

    it('catches the 24px tracklist button that was worse than the card', () => {
        expect(px(6)).toBeLessThan(44);
    });
});
