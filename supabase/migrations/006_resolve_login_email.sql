-- Family login: allow sign-in with email OR contact number (mobile app).
-- Client resolves phone -> auth email via RPC, then signInWithPassword({ email, password }).

-- Sync profiles.phone from either metadata key (signup sends phone and/or contact_number)
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    phone,
    account_type,
    province,
    municipality,
    street,
    house_block_lot
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(trim(coalesce(
      new.raw_user_meta_data->>'contact_number',
      new.raw_user_meta_data->>'phone',
      ''
    )), ''),
    lower(coalesce(new.raw_user_meta_data->>'account_type', 'family')),
    nullif(trim(coalesce(new.raw_user_meta_data->>'province', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'municipality', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'street', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'house_block_lot', '')), '')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        account_type = excluded.account_type,
        phone = coalesce(nullif(excluded.phone, ''), public.profiles.phone),
        province = coalesce(nullif(excluded.province, ''), public.profiles.province),
        municipality = coalesce(nullif(excluded.municipality, ''), public.profiles.municipality),
        street = coalesce(nullif(excluded.street, ''), public.profiles.street),
        house_block_lot = coalesce(nullif(excluded.house_block_lot, ''), public.profiles.house_block_lot),
        updated_at = now();
  return new;
end;
$$;

create or replace function public.resolve_login_email (login_input text)
returns table (email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_input text;
  v_norm text;
  v_email text;
begin
  v_input := trim(coalesce(login_input, ''));
  if v_input = '' then
    return;
  end if;

  if v_input ~ '@' then
    return query select v_input::text;
    return;
  end if;

  v_norm := regexp_replace(v_input, '\D', '', 'g');
  if length(v_norm) < 10 then
    return;
  end if;

  select u.email into v_email
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(coalesce(u.raw_user_meta_data->>'account_type', 'family')) = 'family'
    and (
      regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = v_norm
      or regexp_replace(coalesce(u.raw_user_meta_data->>'phone', ''), '\D', '', 'g') = v_norm
      or regexp_replace(coalesce(u.raw_user_meta_data->>'contact_number', ''), '\D', '', 'g') = v_norm
    )
  limit 1;

  if v_email is not null then
    return query select v_email::text;
  end if;
  return;
end;
$$;

comment on function public.resolve_login_email (text) is
  'Returns auth email for family users: pass full email, or digits-only / formatted phone (matches profiles.phone and user_metadata phone/contact_number).';

grant execute on function public.resolve_login_email (text) to anon;
grant execute on function public.resolve_login_email (text) to authenticated;
