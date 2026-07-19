import React from 'react';
import { Heart } from 'lucide-react';
import logo from '@/assets/kalingalogo.png';

/**
 * Kalinga / Bridges of Hope brand lockup — matches CapstoneMobile FamilyHeaderBrand.
 */
export default function FamilyHeaderBrand({ className = '', onClick = null }) {
  const classes = ['family-header-brand', className].filter(Boolean).join(' ');

  const content = (
    <>
      <div className="family-header-brand__logo-plate">
        <img src={logo} alt="" className="family-header-brand__logo" />
      </div>

      <div className="family-header-brand__text-wrap">
        <span className="family-header-brand__accent" aria-hidden="true" />
        <div className="family-header-brand__text-col">
          <span className="family-header-brand__kalinga">Kalinga</span>
          <span className="family-header-brand__title">
            <span className="family-header-brand__title-lead">Bridges of </span>
            <span className="family-header-brand__title-accent">Hope</span>
          </span>
          <span className="family-header-brand__sub-row">
            <Heart size={11} color="#F54E25" fill="#F54E25" aria-hidden />
            <span className="family-header-brand__sub">Family Portal</span>
          </span>
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-label="Scroll to top">
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}
