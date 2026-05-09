-- Restruktuiranje medaljona Nivoa 1:
-- 6 milestone medaljona, svaki nakon 10 završenih lekcija (10, 20, 30, 40, 50, 60).
-- Vrata (nakon 64) su poseban UI element, ne medaljon u DB.

-- Brišemo postojeće Nivo 1 medaljone i ranije osvojene (early product, prihvatljivo).
DELETE FROM "student_medaljoni" WHERE "medaljon_id" IN (SELECT id FROM medaljoni WHERE nivo = 1);
DELETE FROM "medaljoni" WHERE "nivo" = 1;

INSERT INTO "medaljoni" ("nivo", "slug", "naziv", "opis", "pos_after_redoslijed", "ikona", "boja") VALUES
  (1, 'm1-pocetnik',   'Pčelica početnik',   'Završio si prvih 10 lekcija — postao si pčelica početnik!', 10, 'medal', 'amber'),
  (1, 'm2-radilica',   'Marljiva pčela',     '20 lekcija iza tebe — sad si marljiva pčela radilica.',     20, 'medal', 'orange'),
  (1, 'm3-istrazivac', 'Istraživač cvijeća', '30 lekcija — istraživač cvjetnih polja!',                   30, 'medal', 'yellow'),
  (1, 'm4-cuvar',      'Čuvar košnice',      '40 lekcija — postao si čuvar košnice znanja.',              40, 'medal', 'amber'),
  (1, 'm5-mudrac',     'Mudra pčela',        '50 lekcija — mudra pčela koja sve zna.',                    50, 'medal', 'orange'),
  (1, 'm6-majstor',    'Majstor meda',       '60 lekcija — pravi majstor meda i znanja!',                 60, 'medal', 'yellow')
ON CONFLICT ("slug") DO NOTHING;
