/*
  Remove all legacy CLM records now that CLM workspace is retired.
*/

do $$
begin
  if to_regclass('public.clm_weekly_reports') is not null then
    execute 'truncate table public.clm_weekly_reports restart identity cascade';
  end if;

  if to_regclass('public.clm_incidents') is not null then
    execute 'truncate table public.clm_incidents restart identity cascade';
  end if;
end
$$;
