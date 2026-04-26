alter table trame_reports
  add column if not exists validated_by text null,
  add column if not exists writing_time_min integer null
    check (writing_time_min is null or (writing_time_min >= 1 and writing_time_min <= 10080));
