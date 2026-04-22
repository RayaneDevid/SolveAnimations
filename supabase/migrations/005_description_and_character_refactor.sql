-- Replace document_url with description (free text)
alter table public.animations rename column document_url to description;
alter table public.animations alter column description drop not null;

-- character_name no longer required at apply/create time — filled at report submission
alter table public.animation_participants alter column character_name drop not null;
alter table public.animation_reports alter column character_name drop not null;
