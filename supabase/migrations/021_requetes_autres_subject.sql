alter table requetes
  drop constraint if exists requetes_subject_check;

alter table requetes
  add constraint requetes_subject_check
  check (subject in (
    'grade_superieur_tkj',
    'demande_give',
    'setmodel_tenue',
    'reservation_secteur',
    'situation_problematique',
    'autres'
  ));
