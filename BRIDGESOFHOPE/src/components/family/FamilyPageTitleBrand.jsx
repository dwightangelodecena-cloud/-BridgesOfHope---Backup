import React from 'react';
import logo from '@/assets/kalingalogo.png';

/** Page title brand — matches CapstoneMobile; web may pass subtitle below the title. */
export default function FamilyPageTitleBrand({ title, subtitle = null, className = '' }) {
  return (
    <div className={`family-page-title-brand${className ? ` ${className}` : ''}`}>
      <div className="family-page-title-brand__logo-plate">
        <img src={logo} alt="" className="family-page-title-brand__logo" />
      </div>
      <div className="family-page-title-brand__text-wrap">
        <span className="family-page-title-brand__accent" aria-hidden="true" />
        <div className="family-page-title-brand__text-col">
          <span className="family-page-title-brand__title">{title}</span>
          {subtitle ? <span className="family-page-title-brand__subtitle">{subtitle}</span> : null}
        </div>
      </div>
    </div>
  );
}
