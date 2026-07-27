-- Adds a coarse content category to family_notifications so the mobile inbox can
-- style/group notifications (admission, visitation, promo, clinical, progress, general)
-- instead of guessing from title text. Backfills existing rows from related_type.

alter table public.family_notifications
  add column if not exists category text not null default 'general';

update public.family_notifications
set category = case
  when related_type = 'admission_request' then 'admission'
  when related_type = 'visitation_request' then 'visitation'
  else 'general'
end
where category = 'general';

alter table public.family_notifications
  drop constraint if exists family_notifications_category_check;

alter table public.family_notifications
  add constraint family_notifications_category_check
  check (category in ('admission', 'visitation', 'promo', 'clinical', 'progress', 'general'));

comment on column public.family_notifications.category is
  'Coarse content category for mobile display styling: admission | visitation | promo | clinical | progress | general.';
