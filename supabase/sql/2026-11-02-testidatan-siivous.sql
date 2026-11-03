-- Testidatan siivous ennen omaa käyttöä. Aja Supabasen SQL-editorissa.
-- Varmuuskopio on skeemassa varmuuskopio (*_20261102-taulut).
-- Lukitun mittauspöytäkirjan kirjaus jää: lukitusta ei ohiteta.
begin;
delete from public.entries e
 where e.mittapoytakirja_id is null
    or not exists (select 1 from public.mittapoytakirjat m
                    where m.id = e.mittapoytakirja_id and m.status = 'lukittu');
delete from public.material_requests;
delete from public.noutopyynnot;
delete from public.worksites
 where id in ('5f4effab-1d90-4a69-8965-a0876dc279b0',   -- Arc keilalahti
              'b5ca88b9-562b-45b2-a053-c17f2d7dd153');  -- DEMO Kauppakeskus Valo
update public.worksites set status = 'completed', completed_at = now()
 where id = '22222222-2222-2222-2222-222222222222';     -- As Oy Demonkuja 5
commit;
