Design features
- Diagonal gradient background with dual accent glows (top-right + bottom-left)
- Realistic device frame — dark metallic bezel, edge highlight, glass sheen
- Dynamic Island on iPhone 67/61, notch on iPhone 65
- Home indicator bar on iOS devices
- Word-wrapped bold headline (top 22% zone)
- Caption text (bottom zone) with slide position dots
- Accent bar divider between headline and device

Customization
Edit config/slides.json to change:
- theme.gradientColors — background gradient
- theme.accentColor — glow and accent bar color
- layout.*Pct — zone proportions, font sizes
- slides[].headline / slides[].caption — per-slide text

Then just: npm run generate