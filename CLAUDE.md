# Mattomies Äppi — projektimuistio

Lue tämä ennen ensimmäistä muutosta. Päivitetty 3.11.2026.

## Mikä tämä on

Suomenkielinen PWA mattoasentajalle. Tekijät: **Teppo Haukilahti** (mattoasentaja, ei-tekninen,
testaa puhelimella työmaalla) ja poika **Eemil** (työpari).

**Nykytila: oma käyttö.** Heikkinen ei ottanut äppiä käyttöön, joten se on nyt Tepon ja Eemilin
omassa käytössä. Tavoite on todistaa hyöty ja esitellä äppi myöhemmin uudestaan.
Työnjohdon, varaston, QR-ketjun ja mittauspöytäkirjojen toiminnot on **piilotettu, ei poistettu**:
lippu `OMA_KAYTTO` tiedostossa `src/lib/tila.ts`. Älä poista piilotettua koodia.

Asentajan käytössä olevat osat:
- Urakka- ja tuntikirjaukset (WorksitePage-peukalopalkki, Kirjaa = PaivakirjausPage)
- Työpari: yksi äppi tekee tililaput Tepolle ja Eemilille (`lib/tyopari.ts`, `components/TekijaValinta.tsx`)
- Heikkisen virallinen tililappu Excelinä (`public/tililappu-pohja.xlsx`, `lib/tililappuExport.ts`, `lib/tililappuMap.ts`)
- Tunti-PDF:t Heikkisen logolla: Kuitattavat tunnit (rakennusmestarille) ja Kaikki tunnit (omalle työnjohtajalle) (`lib/tuntiPdf.ts`)
- Raportti (RaporttiPage): jaksot Tänään / Tämä vko / Ed. vko / Palkkakausi / Valitse päivät / Kaikki
- Laskin+ (LaskinPage, sis. nostomattolaskurin)
- Omat tiedot ja työpari (AsetuksetPage): nimi, henkilönumero, tuntipalkka, työparin tiedot, urakkajako-%, salasanan vaihto

## Työnkulku (näin muutokset menevät tuotantoon)

- GitHub: `teppohaukilahti-droid/asentaja-mvp`, päähaara `main`
- Vercel: projekti `asentaja-mvp`, tiimi `haukilahti`. Tuotanto: **https://asentaja-mvp.vercel.app**
- Vercel on kytketty GitHubiin: **push `main`-haaraan = julkaisu tuotantoon**. Muut haarat saavat
  oman esikatseluosoitteen (vaatii Vercel-kirjautumisen).

Tee jokainen muutos näin:
1. Tee muutos omaan haaraan.
2. Aja kaikki kolme ja korjaa virheet ennen pushia:
   - `npm run build` (= `tsc -b && vite build`, tiukempi kuin pelkkä tsc)
   - `npm run lint`
   - `npm test` (vitest, testit `src/lib/__tests__/`)
3. Push haaraan ja tee pull request `main`-haaraan. Kerro Tepolle esikatseluosoite, jos sellainen syntyy.
4. Teppo hyväksyy (merge) puhelimesta, ja Vercel julkaisee tuotantoon automaattisesti.
   Mergeä itse vain, jos Teppo pyytää julkaisemaan suoraan.

Tepolle raportoidaan aina lyhyesti suomeksi: mitä muuttui, missä sen näkee äpissä ja onko se jo tuotannossa.

## Tyyli (ehdoton)

- Hillitty työkalu, ei esittelysivu. Järjestelmäfontit, ei liukuvärejä, ei emojeita käyttöliittymässä.
- Tumma teema: tausta `bg-gray-950`, kortit `bg-gray-900` + `border-gray-800`, pyöristys `rounded-xl`.
- **Amber (`amber-500`) vain pääpainikkeelle.** Valittu valintanappi on vaalea: `bg-gray-100 text-gray-950`.
- Rahasummat valkoisella (`tabular-nums`), tunnit himmeämmällä. Ei vihreää/sinistä/keltaista rahaa.
- Ei ikoneita otsikoiden edessä, ei VERSAALI-pikkuotsikoita, ei katkoviivakortteja.
- Yhteenvedot tilikirjan riveinä (nimi vasemmalla, summa oikealla), yksi summa isona.
- "Seppo-testi": 60-vuotias asentaja oppii 10 minuutissa. Isot napit (vähintään 44 px), tekstinapit.
- Kaikki käyttöliittymätekstit ja koodikommentit suomeksi.
- Termit: "Kuitattavat tunnit" ja "Heikkisen tunnit" (ei "Omat tunnit" äpin puolella).

## Stack

- React 19 + TypeScript + Vite + Tailwind v4 (`@import "tailwindcss"` index.css:ssä)
- Supabase-projekti `ofkmmgcranlaigjsrgyv` ("Mattomies"). URL ja julkinen anon-avain ovat
  `src/lib/supabase.ts`:ssä varmuusarvoina, joten ympäristömuuttujia ei tarvita buildiin.
- Ilmaisversio menee tauolle, jos kantaa ei käytetä. Jos äppi ei saa yhteyttä, ensimmäinen epäilty on
  tauolla oleva kanta. Teppo herättää sen Supabasen hallintapaneelista.
- Kaikki sivut ladataan `React.lazy`:llä. jspdf, exceljs ja qrcode ladataan dynaamisesti napista.
- exceljs: kaavojen välimuistitulokset poistetaan ja `fullCalcOnLoad` asetetaan,
  muuten tililappu näyttää pohjan esimerkkisummat.

## Tietokanta

- Asentajan käyttämät taulut: `worksites`, `entries`, `tes_codes`, `profiles`, `presets`.
- `entries.tekija`: 'mina' | 'pari' | 'molemmat'. Molempien urakat jaetaan prosentilla
  (`profiles.tyopari_osuus_pct` = työparin osuus), molempien tunnit tulevat kummallekin kokonaan.
- Kirjaustyypit: 'tunti' (`hour_category` 'kuitattava' tai 'oma' = Heikkisen tunnit), 'urakka', 'vapaa-urakka'.
- `tes_codes`: TES 1.6.2026 -hinnasto, 141 aktiivista koodia. Vanhoja ei poisteta, vaan `active = false`.
  Uusi koodi lisätään myös `src/lib/tililappuMap.ts`:ään täsmälleen tililappupohjan nimikkeellä.
- `worksites.status` sallii vain 'active', 'completed' ja 'paused'.
- `organization_id` ja RLS jokaisessa taulussa. Mestarin lukitsemaa (status 'lukittu') ei muuteta
  koskaan, ei edes SQL:llä: kantatriggerit estävät sen tarkoituksella. Älä ohita niitä.
- Offline-jono: localStorage-avain `profloor_outbox_v1`. Älä nimeä uudelleen, koska jonossa voi olla dataa.
- Skeema `varmuuskopio`: testidatan varmuuskopio 2.11.2026. Ei näy äpille. Älä poista.
- Tietokantamuutokset: kirjoita SQL tiedostoon `supabase/sql/YYYY-MM-DD-kuvaus.sql` ja kerro Tepolle,
  että se pitää ajaa Supabasen SQL-editorissa. Älä oleta, että sinulla on suora pääsy kantaan.

## Tunnukset

Testitunnukset ovat TESTIOHJE.md:ssä. Älä kopioi salasanoja muihin tiedostoihin, commit-viesteihin tai
keskusteluun. Älä vaihda kenenkään salasanaa: äpissä on Omat tiedot → Vaihda salasana.

## Avoimet asiat

1. **Testidatan siivous**: 22 testikirjausta ja 3 demotyömaata ovat yhä kannassa. SQL on valmiina
   (poistaa kirjaukset paitsi lukitun pöytäkirjan yhden kirjauksen, poistaa Arc keilalahden ja
   DEMO Kauppakeskus Valon, merkitsee As Oy Demonkujan valmiiksi). Teppo ajaa sen SQL-editorissa.
2. **Paikallinen versio** (vain puhelimessa, ilman palvelinta) on harkinnassa muille käyttäjille.
   Arvio 4–6 iltaa. Ei aloitettu. Vaatii pakollisen varmuuskopion tiedostoksi.
3. Uudella työmaalla on kenttä "Rakennusliike" (`client_company`), joka menee tililapun kohtaan J3.
   Olemassa olevan työmaan tietoja ei vielä voi muokata äpissä.
4. `worksites.status`-rajoite ei salli arvoa 'pyynto', jota piilotettu "Pyydä työnjohdolta" käyttää.
   Ei vaikuta omaan käyttöön.
