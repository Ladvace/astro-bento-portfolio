# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal portfolio website built with Astro, featuring a bento-style, minimal, single-page design. The site showcases Calvin's professional background, cycling goals, and personal interests.

## Development Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm check

# Linting
pnpm eslint
```

Note: `pnpm preview` is not supported due to the Netlify adapter configuration. Use `pnpm build` and deploy to Netlify for production testing.

## Tech Stack & Architecture

- **Framework**: Astro with server-side rendering
- **UI Components**: Mix of Astro and Svelte components
- **Styling**: UnoCSS (atomic CSS framework)
- **Icons**: Astro Icon with Font Awesome 6 brands
- **Animation**: Motion library
- **Deployment**: Netlify with edge middleware

## Key Architecture Points

### Component Structure
- **Astro Components**: Main UI components (`.astro` files) for static content
- **Svelte Components**: Interactive components like `ThemeSwitcher.svelte` and `ProgressBar.svelte`
- **Card System**: Reusable card layout in `src/components/Card/` with `index.astro` and `Content.astro`

### Configuration & Content
- **Constants**: All site content and configuration centralized in `src/lib/constants.ts`
- **Personal Data**: Update `constants.ts` to modify personal details, career info, goals, and metadata
- **Site Config**: Main site configuration in `astro.config.mjs` (site URL, integrations)

### Styling System
- **UnoCSS**: Atomic CSS with custom theme configuration in `uno.config.ts`
- **Theme Support**: Dark/light mode via CSS custom properties and Svelte theme switcher
- **Custom Design System**: Predefined colors (gray, darkslate, primary), shadows, and grid templates

### Layout Hierarchy
- `BasicLayout.astro` → `Layout.astro` → page components
- Loader functionality built into layout system
- Responsive bento grid layout for different screen sizes

## Content Management

All site content is managed through `src/lib/constants.ts`:
- `LINKS`: Social media and external links
- `CAREER`: Professional experience
- `ABOUT_ME`: Personal description
- `GOAL`: Cycling progress tracking
- `WELCOME`: Hero section content  
- `NOW`: Current status
- `METADATA`: SEO and site metadata

## Deployment

The site is configured for Netlify deployment with:
- Server-side rendering enabled
- Edge middleware support
- Automatic sitemap generation
- Robots.txt generation

## Memories

- Any user configurable variable are implemented and configured in `src/lib/constants.ts`