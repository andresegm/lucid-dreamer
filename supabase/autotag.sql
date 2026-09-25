-- Auto-tag imported dreams from their text.
--
-- The old DreamJournal export barely used tags (39 of 502 dreams), but the dream text
-- mentions the same people, places and themes over and over. This script attaches a tag to
-- every dream whose title or description matches a keyword rule.
--
-- * Safe to re-run: only ADDS links, never removes; existing tags are reused (case-insensitive).
-- * Edit the rule list below freely before running. Delete a line to skip that tag.
-- * Patterns are PostgreSQL regexes. \m = start of word, \M = end of word.
--   Rules are case-insensitive unless the third column is true.
-- * Afterwards, use the Tags page in the app to rename/merge/delete anything you don't like.
--
-- Run in Supabase → SQL Editor AFTER schema.sql and seed.sql.

begin;

create temp table autotag_rules (tag text, pattern text, case_sensitive boolean default false) on commit drop;

-- ---------- People ----------
insert into autotag_rules (tag, pattern) values
  ('Lusho',     '\mLusho\M'),
  ('Diego',     '\mDiego\M'),
  ('Maria',     '\mMaria\M'),
  ('Luisa',     '\mLuisa\M'),
  ('Tonka',     '\mTonka\M'),
  ('Pau',       '\mPau\M'),
  ('Silvana',   '\mSilvana\M'),
  ('Carolina',  '\mCarolina\M'),
  ('Dii',       '\mDii\M'),
  ('Juan',      '\mJuan\M'),
  ('Angel',     '\mAngel\M'),
  ('Mariana',   '\mMariana\M'),
  ('Fiona',     '\mFiona\M'),
  ('Paula',     '\mPaula\M'),
  ('Ariana',    '\mAriana\M'),
  ('Alejandro', '\mAlejandro\M'),
  ('Vicente',   '\mVicente\M'),
  ('Tevin',     '\mTevin\M'),
  ('Megan',     '\mMegan\M'),
  ('Laura',     '\mLaura\M'),
  ('Alvaro',    '\mAlvaro\M');

-- ---------- Places ----------
insert into autotag_rules (tag, pattern) values
  ('Venezuela', '\mVenezuela\M'),
  ('Canada',    '\mCanada\M'),
  ('Miami',     '\mMiami\M'),
  ('Calgary',   '\mCalgary\M'),
  ('Florida',   '\mFlorida\M');

-- ---------- Themes ----------
insert into autotag_rules (tag, pattern) values
  ('zombies',     '\mzombies?\M'),
  ('apocalypse',  '\mapocalypse\M'),
  ('flying',      '\m(fly|flying|flew|flies)\M'),
  ('school',      '\m(school|class|classes|teacher|university|college|exam|exams)\M'),
  ('family',      '\m(family|mom|mother|dad|father|brother|sister|grandma|grandpa|abuela|abuelo)\M'),
  ('house',       '\m(house|home)\M'),
  ('beach',       '\mbeach(es)?\M'),
  ('ocean',       '\m(ocean|sea|waves?)\M'),
  ('surfing',     '\m(surf|surfing|surfed|surfboard)\M'),
  ('fighting',    '\m(fight|fighting|fought|gun|guns|shoot|shooting|shot|knife|knives|sword|swords|kill|killed|killing)\M'),
  ('dogs',        '\mdogs?\M'),
  ('shark',       '\msharks?\M'),
  ('party',       '\m(party|parties)\M'),
  ('hotel',       '\mhotels?\M'),
  ('soccer',      '\m(soccer|football)\M'),
  ('driving',     '\m(driving|drove|drive)\M'),
  ('video games', '\m(video ?games?|zelda|goku|dbz|dragon ?ball|assassin''?s creed|minecraft|pokemon|mario)\M'),
  ('taekwondo',   '\mtaekwondo\M'),
  ('intimacy',    '\m(kiss|kissed|kissing|sex|making out|made out)\M'),
  ('teleportation','\m(teleport|teleported|teleporting|teleportation)\M'),
  ('nightmare',   '\mnightmares?\M');

-- ---------- Lucid-dreaming technique (case-sensitive so "FA"/"RC"/"SP" only match as acronyms) ----------
insert into autotag_rules (tag, pattern, case_sensitive) values
  ('false awakening', '(\mFAs?\M|[Ff]alse [Aa]wakenings?)', true),
  ('reality check',   '(\mRCs?\M|[Rr]eality [Cc]hecks?)', true),
  ('sleep paralysis', '(\mSP\M|[Ss]leep [Pp]aralysis)', true),
  ('DILD',            '\mDILD\M', true),
  ('WILD',            '\mWILD\M', true),
  ('DEILD',           '\mDEILD\M', true),
  ('MILD',            '\mMILD\M', true),
  ('WBTB',            '\mWBTB\M', true);

-- Create any tags that don't exist yet (case-insensitive match against existing names).
insert into public.tags (name)
select distinct r.tag
from autotag_rules r
where not exists (select 1 from public.tags t where lower(t.name) = lower(r.tag));

-- Link matching dreams. Only real dreams (not notes); title + description are searched.
insert into public.dream_tags (dream_id, tag_id)
select d.id, t.id
from autotag_rules r
join public.tags t on lower(t.name) = lower(r.tag)
join public.dreams d
  on d.entry_type = 'dream'
 and (
      (    r.case_sensitive and (d.title || ' ' || d.description) ~  r.pattern)
   or (not r.case_sensitive and (d.title || ' ' || d.description) ~* r.pattern)
 )
on conflict do nothing;

commit;

-- Resulting tag usage, most used first.
select t.name, count(dt.dream_id) as dreams
from public.tags t
left join public.dream_tags dt on dt.tag_id = t.id
group by t.name
order by dreams desc, t.name;
