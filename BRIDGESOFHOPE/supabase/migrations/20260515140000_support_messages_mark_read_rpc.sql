-- Reliable admin "mark thread read" even when direct UPDATE is blocked by RLS edge cases.

create or replace function public.bh_mark_support_read_by_admin(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.bh_is_admin() then
    raise exception 'not authorized';
  end if;
  update public.support_messages
  set read_by_admin_at = now()
  where family_id = p_family_id
    and sender_role = 'family'
    and read_by_admin_at is null;
end;
$$;

grant execute on function public.bh_mark_support_read_by_admin(uuid) to authenticated;
