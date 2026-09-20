-- ============================================================
-- Add lore + responsable_lore roles — mirrors mj / responsable_mj
-- Enum values only : ils doivent être committés avant d'être
-- référencés par une contrainte ou une policy (migration 051).
-- ============================================================

alter type staff_role add value if not exists 'responsable_lore';
alter type staff_role add value if not exists 'lore';
