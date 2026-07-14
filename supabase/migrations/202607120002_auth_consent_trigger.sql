-- Store required consent records atomically when the Auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parsed_birth_date date;
begin
  parsed_birth_date := (new.raw_user_meta_data ->> 'birth_date')::date;
  if parsed_birth_date is null then raise exception 'A valid birth_date is required'; end if;

  insert into public.profiles (id, birth_date)
  values (new.id, parsed_birth_date);

  insert into public.user_consents (user_id, consent_type, version, accepted)
  values
    (new.id, 'terms', coalesce(new.raw_user_meta_data ->> 'terms_version', '2026-07-12'), true),
    (new.id, 'privacy', coalesce(new.raw_user_meta_data ->> 'privacy_version', '2026-07-12'), true);
  return new;
exception when invalid_text_representation or datetime_field_overflow then
  raise exception 'A valid birth_date is required';
end;
$$;
