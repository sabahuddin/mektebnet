-- =============================================================================
-- DEMO USER: demo-uspjeh / demo123
-- Učenik koji je završio sve — sve lekcije, svi bedževi, svi medaljoni,
-- sva krunisanja. Idempotentno: može se pokrenuti više puta bez duplikata.
--
-- Pokretanje (PROD):
--   psql "$PROD_DATABASE_URL" -f scripts/seed-demo-uspjeh.sql
--
-- Napomene:
--   - Šifra je bcrypt hash od 'demo123' (cost 10).
--   - Lekcije/medaljoni/krunisanja se traže lookup-om iz baze pa radi na
--     bilo kojem env-u (dev/staging/prod) bez hard-coded ID-jeva.
--   - grupa_id/muallim_id/mekteb_id ostavljeni NULL — admin može kasnije
--     dodijeliti učenika u grupu kroz admin panel.
-- =============================================================================

BEGIN;

-- 1) USER
INSERT INTO users (username, email, password_hash, display_name, role, is_active, trial_until)
VALUES (
  'demo-uspjeh',
  'demo-uspjeh@mekteb.local',
  '$2b$10$aNe7X/kMlpgDPX9x1RPVyerMpGw4IwmpugpP1wKQvadaE2AH4V6ZW',
  'Demo Uspjeh',
  'ucenik',
  true,
  NULL
)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_active = true,
  trial_until = NULL,
  display_name = EXCLUDED.display_name;

DO $$
DECLARE
  uid INT;
  today_str TEXT := to_char(now(), 'YYYY-MM-DD');
  all_lesson_ids INT[];
  med RECORD;
  kr RECORD;
BEGIN
  SELECT id INTO uid FROM users WHERE username = 'demo-uspjeh';

  -- 2) UCENIK PROFIL (bez grupe — admin dodijeli kasnije)
  INSERT INTO ucenik_profili (user_id, muallim_id, grupa_id, mekteb_id, is_archived)
  VALUES (uid, NULL, NULL, NULL, false)
  ON CONFLICT (user_id) DO UPDATE SET
    is_archived = false,
    archived_at = NULL;

  -- 3) STUDENT PROGRESS — sve lekcije + svi bedževi
  SELECT array_agg(id ORDER BY nivo, redoslijed) INTO all_lesson_ids
    FROM ilmihal_lekcije;

  INSERT INTO student_progress (
    student_id, total_hasanat, total_med, completed_lessons, badges,
    streak_days, last_activity_date
  ) VALUES (
    uid::text, 5000, 2000,
    COALESCE(to_jsonb(all_lesson_ids), '[]'::jsonb),
    jsonb_build_array(
      jsonb_build_object('id','prvi_korak',     'earnedAt', now()),
      jsonb_build_object('id','lekcije_10',     'earnedAt', now()),
      jsonb_build_object('id','lekcije_30',     'earnedAt', now()),
      jsonb_build_object('id','lekcije_50',     'earnedAt', now()),
      jsonb_build_object('id','lekcije_100',    'earnedAt', now()),
      jsonb_build_object('id','streak_3',       'earnedAt', now()),
      jsonb_build_object('id','streak_7',       'earnedAt', now()),
      jsonb_build_object('id','streak_30',      'earnedAt', now()),
      jsonb_build_object('id','hasanati_500',   'earnedAt', now()),
      jsonb_build_object('id','hasanati_1000',  'earnedAt', now()),
      jsonb_build_object('id','prvi_kviz',      'earnedAt', now()),
      jsonb_build_object('id','kvizovi_10',     'earnedAt', now()),
      jsonb_build_object('id','kviz_majstor',   'earnedAt', now()),
      jsonb_build_object('id','nivo_1_complete','earnedAt', now()),
      jsonb_build_object('id','nivo_2_complete','earnedAt', now()),
      jsonb_build_object('id','nivo_3_complete','earnedAt', now())
    ),
    30, today_str
  )
  ON CONFLICT (student_id) DO UPDATE SET
    total_hasanat       = EXCLUDED.total_hasanat,
    total_med           = EXCLUDED.total_med,
    completed_lessons   = EXCLUDED.completed_lessons,
    badges              = EXCLUDED.badges,
    streak_days         = EXCLUDED.streak_days,
    last_activity_date  = EXCLUDED.last_activity_date,
    updated_at          = now();

  -- 4) MEDALJONI — svi osvojeni, sve etape položene 100%
  FOR med IN SELECT id FROM medaljoni LOOP
    INSERT INTO student_medaljoni (student_id, medaljon_id, earned_at)
    VALUES (uid::text, med.id, now())
    ON CONFLICT (student_id, medaljon_id) DO NOTHING;

    INSERT INTO etapa_polaganja (
      student_id, medaljon_id, broj_tacnih, broj_pitanja, procenat, polozeno, pokusaj_br
    ) VALUES (uid::text, med.id, 10, 10, 100, true, 1)
    ON CONFLICT (student_id, medaljon_id, pokusaj_br) DO UPDATE SET
      broj_tacnih = 10, broj_pitanja = 10, procenat = 100, polozeno = true;
  END LOOP;

  -- 5) KRUNISANJA — sva položena 100%
  FOR kr IN SELECT id FROM krunisanja LOOP
    INSERT INTO student_krunisanja (
      student_id, krunisanje_id, broj_tacnih, broj_pitanja, procenat, polozeno_at
    ) VALUES (uid::text, kr.id, 10, 10, 100, now())
    ON CONFLICT (student_id, krunisanje_id) DO UPDATE SET
      procenat = 100, broj_tacnih = 10, broj_pitanja = 10, polozeno_at = now();
  END LOOP;

  RAISE NOTICE 'Demo user id=% — % lekcija, % medaljona, % krunisanja',
    uid,
    COALESCE(array_length(all_lesson_ids, 1), 0),
    (SELECT count(*) FROM student_medaljoni WHERE student_id = uid::text),
    (SELECT count(*) FROM student_krunisanja WHERE student_id = uid::text);
END $$;

COMMIT;

-- Verifikacija
SELECT u.id, u.username, u.role, u.is_active,
       sp.total_hasanat, sp.total_med,
       jsonb_array_length(sp.completed_lessons) AS lekcija,
       jsonb_array_length(sp.badges) AS bedzeva,
       (SELECT count(*) FROM student_medaljoni WHERE student_id = u.id::text) AS medaljoni,
       (SELECT count(*) FROM student_krunisanja WHERE student_id = u.id::text) AS krunisanja
FROM users u
LEFT JOIN student_progress sp ON sp.student_id = u.id::text
WHERE u.username = 'demo-uspjeh';
