web application/stitch/projects/8922698599729641700/screens/e18b8c398bb6408e864721f9a3a4778d
# Executive Minimalist Design System

This document outlines the visual language and structural components for the AuthSystem project. The system is designed to convey trust, professionalism, and clarity through a minimalist aesthetic.

## 1. Visual Language

### Color Palette
- **Primary**: `#0f172a` (Deep Navy) — Used for primary actions, headings, and high-contrast elements.
- **Surface**: `#f7f9fb` (Off-White) — Primary background color for the application.
- **Surface Container**: `#ffffff` (White) — Used for elevated cards and content containers.
- **Outline**: `#d8dadc` — Used for borders, dividers, and input field boundaries.
- **Text (On-Surface)**: Slate grays and deep navies for high readability.

### Typography
- **Primary Font**: **Manrope** — A modern sans-serif that balances geometric shapes with dynamic qualities.
- **Scale**:
  - **Headline**: Bold, high contrast, used for page titles and card headers.
  - **Body**: Regular weight, optimized for legibility in forms and descriptions.
  - **Label**: Bold, smaller scale for field labels and secondary actions.

### Design Principles
- **Roundness**: `ROUND_FOUR` (approx 4px) — Subtle rounding for a modern but professional feel.
- **Elevation**: Flat with very soft, subtle shadows to define depth without clutter.
- **Spacing**: Generous whitespace (`px-lg`, `py-md`) to ensure elements breathe and focus is maintained on the primary task.

## 2. Core Components

### TopAppBar
- **Branding**: "AuthSystem" in bold primary typography.
- **Navigation**: Minimalist links (Product, Company) with "Support" as a secondary call to action.
- **Style**: Fixed-top, transparent or surface-matching background.

### Auth Card (The "Professional Login & Sign Up")
- **Structure**: A centered card on a surface-dim background.
- **Navigation**: Tabbed interface switching between "Sign In" and "Create Account".
- **Forms**: 
  - Input fields with clear labels (Full Name, Email Address, Password).
  - High-contrast "Create Account" primary button.
  - Divider with "OR CONTINUE WITH" text.
- **Social Auth**: Standardized "Google" login button.

### Footer
- **Links**: Privacy Policy, Terms of Service, Security, Status.
- **Copyright**: © 2024 AuthSystem Inc. All rights reserved.

## 3. Application State
- **Current Version**: 1.1 (Removed Apple Login option)
- **Target Device**: Desktop (Responsive)
