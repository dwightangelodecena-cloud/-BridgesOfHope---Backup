/** Shared easing + duration for family sidebar expand/collapse */
export const FAMILY_SIDEBAR_TRANSITION = '0.42s cubic-bezier(0.22, 1, 0.36, 1)';

/** CSS custom properties for the expandable family portal sidebar */
export function familySidebarStyle(isExpanded) {
  return {
    '--family-sidebar-w': isExpanded ? '292px' : '110px',
    '--family-sidebar-logo-w': isExpanded ? '42px' : '46px',
    '--family-sidebar-pad': isExpanded ? '28px' : '33px',
    '--family-sidebar-justify': 'flex-start',
    '--family-sidebar-indicator-left': isExpanded ? '12px' : '6px',
    '--family-sidebar-label-opacity': isExpanded ? '1' : '0',
    '--family-sidebar-label-max-w': isExpanded ? '160px' : '0px',
    '--family-sidebar-brand-opacity': isExpanded ? '1' : '0',
    '--family-sidebar-brand-max-w': isExpanded ? '220px' : '0px',
    '--family-sidebar-brand-gap': isExpanded ? '10px' : '0px',
  };
}
