# TESTIOHJE — FloorData

## 1. Julkaisu (ensimmäisenä, ~1 min)

Uusia npm-paketteja EI tullut — `npm install` ei tarvita.

```
cd ~/Downloads/asentaja-mvp
npx vercel --prod --archive=tgz --scope haukilahti
```

Kun näkyy "✓ Ready", avaa https://asentaja-mvp.vercel.app puhelimella ja koneella.

## 0000. UUTTA: Johtajan näkymä v2 — "Riidaton mittaristo"

**Uusi testitunnus: johtaja@test.fi / Testi123!** (luotu suoraan kantaan, hyväksytty valmiiksi).

Johtajan etusivu on rakennettu kokonaan uusiksi lukitun suunnitelman mukaan (holvissa
[[Johtajan näkymä]]). Ydinajatus: **jokainen luku aukeaa allekirjoitukseen asti** — ja
huonot uutiset kerrotaan ensin.

**Osiot ylhäältä alas:**
1. **Viikko kolmella lauseella** — laskettua suomea suoraan kannasta, ei tekoälyä. Säännöt: katteen syöjä ensin, sitten hiljainen työmaa, laskuttamaton raha, kalusto, myöhässä olevat toimitukset — ja hyvä uutinen jos tilaa jää. Jokainen lause on nappi joka vie syyn äärelle.
2. **Kate-vaaka työmaittain** — kate-ennuste lasketaan kustannuskertymästä ja valmiusasteesta (earned value -periaate). Punainen = syö katetta, vihreä = kate syntyy. Palkki näyttää kustannuksen suhteessa urakkaan. Napautus avaa työmaan → kirjausrivit → pöytäkirja → allekirjoitus.
3. **Laskuttamaton raha** — kirjaamattomat varastohaut + eskaloidut pöytäkirjat. "Merkitse laskutetuiksi" vie haut pois pinosta, "Avaa laskutuspino" vie Raportteihin.
4. **Yksikkövertailu** (DEMO-leima) — Tampere/Espoo/Turku demoyksikköinä + oma yksikkö LIVE-rivinä, ajurit vieressä (hukka-%, h/m²). Konsernimittariston esimuoto — portaikon porras 3.
5. **Vaatii huomiota** — hiljaiset työmaat, myöhässä toimitukset, kalusto, eskaloinnit.
6. **Kysy työnjohtajalta** — kate-kortista tai alavalikosta: kysymys menee työnjohtajan Oma viikko -tehtäviin nimellä ja työmaalla varustettuna.

**Testipolku (johtaja@test.fi):**
1. Etusivu: kolme lausetta kertovat suoraan että Kauppakeskus Valo syö katetta ja Demonkuja on hiljentynyt. Napauta lausetta → päädyt työmaalle.
2. Kate-vaaka: Keilalahti vihreällä (kate syntyy), Valo punaisella. Napauta Valoa → työmaan kirjaukset → avaa pöytäkirja → mestarin allekirjoitus. Tämä on se "riidaton luku" -ketju joka näytetään pitchissä.
3. Kate-kortin "Kysy työnjohtajalta" → kirjoita kysymys → kirjaudu työnjohtajana → Kalenteri → Oma viikko → kysymys on tehtävälistalla tänään.
4. Laskuttamaton raha → "Merkitse laskutetuiksi" → laskuri nollautuu (varastohaut siirtyvät laskutettu-tilaan).
5. Yksikkövertailu: oma yksikkö LIVE-rivinä demoyksiköiden rinnalla, kate värikoodattuna.

Huom: demotyömaiden urakkasummat on skaalattu pieniksi jotta ne täsmäävät olemassa oleviin
testikirjauksiin (esim. Keilalahti 2 300 €). Heikkisen pilotissa kentät täytetään oikeilla
summilla työmaan perustamisen yhteydessä — laskenta on sama.

## 000. UUTTA: Varasto-moduuli (pitchin ydin — liimapurkin matka)

Varaston etusivu (varasto@test.fi) on rakennettu kokonaan uusiksi. Periaate: **liikennevalosaldo, ei tarkkoja määriä** — varastomies päivittää tilan yhdellä napautuksella (Hyllyssä / Vähissä / Loppu), ja tilaussilmukka kulkee kehän umpeen: Loppu → Merkitse tilatuksi → Saapuva tavara → Hyllyyn.

Demodata on valmiina kannassa: 7 tuotetta liikennevaloineen ja hyllypaikkoineen (mm. **Tarkett iQ Granit, koodi JL60 412**, hylly A3), 3 konetta joista Hitsausautomaatti #1:llä on avoin vikailmoitus, ja 2 noutopyyntöä työmailta.

**Testipolku (varasto@test.fi):**
1. **Koodihaku**: etusivun ylin kenttä → kirjoita `jl60 412` (välilyönnillä tai ilman) → Tarkett iQ Granit löytyy, näet liikennevalon ja hyllypaikan. Tämä on se "puhelin lakkaa soimasta" -hetki.
2. **Liikennevalo**: napauta tuotetta → kolme isoa nappia (Hyllyssä/Vähissä/Loppu) → valitse Loppu → tuote ilmestyy Tilaa näitä -listalle.
3. **Tilaa näitä**: lista ryhmittyy toimittajittain (Kiilto, Tarkett…), punaiset ensin → "Merkitse tilatuksi" → tuote siirtyy Saapuva tavara -osioon.
4. **Saapuva tavara**: "Hyllyyn — saldo kuntoon" → liikennevalo takaisin vihreäksi. Silmukka kiinni, tuplatilauksia ei tule.
5. **Uusi tuote (liukuhihna)**: Tuotteet-osion "Uusi tuote" → koodi, nimi, hyllypaikka, toimittaja, tila → "Lisää ja jatka seuraavaan" — sheet jää auki seuraavaa varten (toimittaja ja yksikkö muistetaan). Tarrat kertyvät jonoon → "Tulosta uudet hyllytarrat (N)" tulostaa vain uudet ja kuittaa jonon. Tarrassa on nyt myös koodi ja hyllypaikka.
6. **Noutopyyntö** (asentajana/työnjohtajana): työmaasivu → Tilaa tavaraa → valitse "Nouto varastoon" → mitä, määrä, missä → lähetä. Varaston etusivulle ilmestyy Noudot työmailta → "Noudettu varastoon".
7. **Ilmoita vika** (asentajana): Työkalut → avaa kone → "Ilmoita vika" → kuvaus → kone siirtyy Huollossa-tilaan ja varaston Vikailmoitukset-listalle. Varastona: "Korjattu — takaisin käyttöön" → kone varastossa, historia tallessa (tapahtumaloki).
8. **Kalusto**: varaston etusivun alin osio — missä ja kenellä joka kone, napautus avaa koneen.
9. **Läpikulku**: kun työnjohtaja tilaa tarpeen toimittajalta (Tilaa toimittajalta → Merkitse tilatuksi), se ilmestyy varaston Saapuvaan tavaraan → "Saapui varastolle — keräilyyn" → keräilyjonosta "Toimitettu työmaalle".

Varastohaku-sivulla (kaikki roolit) on nyt sama koodihaku ja tuotenapeissa liikennevalo + hyllypaikka — asentajakin näkee suoraan onko tavaraa ennen kuin ajaa varastolle.

## 00. UUTTA: Kalenteri v3 — resursointi, lukujärjestys ja ICS

Kalenterissa (työnjohto/johtaja, yläpalkin keltainen kuvake) on nyt kolme välilehteä:

**Resursointi** — viikkopalaverin korvaaja. Työmaat riveinä (etenemispalkki nimen alla), viikot sarakkeina, soluissa asentajat. Solun +-napista kiinnitetään asentaja työmaalle: valinnassa näkyy suoraan kuka on vapaana kyseisellä viikolla. Kiinnitys tallentuu EHDOTUKSENA (katkoviivachip + ehdottajan nimi) ja **varmistuu itsestään 24 h kuluttua ellei kukaan vastusta**. Chipin napautus: Vahvista heti / Vastusta (syyllä) / Poista. Punainen chip = sama mies kahdella työmaalla samalla viikolla. ↦ = vapautuu sillä viikolla. Varoituskolmio = kirjaukset tulevat eri työmaalta kuin suunnitelma sanoo. Vasta varmistettu miehitys näkyy asentajalle — hänen etusivulleen ilmestyy "Seuraava työmaa: X, alkaen pp.kk."

**Oma viikko** — työnjohtajan lukujärjestys. Ylimpänä punainen "Vaatii toimia" -kaista: materiaalisaldot alle hälytysrajan, kiiretarpeet, myöhässä olevat toimituslupaukset ja eskaloidut pöytäkirjat — jokaisesta saa yhdellä napautuksella tehtävän ("→ tehtäväksi"). Alla ma–su-päivät: toimitukset, vapautumiset, valmistumiset, omat merkinnät ja tehtävät ruksattavina. Päivän +-napista lisätään tehtävä tai merkintä. Työmaanapit alimpana avaavat työmaapaneelin: liikennevalo + "hiljainen työmaa" -varoitus (miehitys on, kirjauksia ei 3 päivään), materiaalisaldot hälytysrajoineen (raja säädetään tässä — tyhjä = ei hälytystä), miehitys vapautumisarvioineen, tarpeet ja toimituslupaukset, soitto mestarille.

**Kuukausi** — pitkä tähtäin + **"Kopioi kalenterilinkki"**: henkilökohtainen ICS-syöte jonka tilaat puhelimen omaan kalenteriin (Google: Asetukset → Lisää kalenteri → URL-osoitteesta; iPhone: Asetukset → Kalenteri → Tilit → Lisää tilattu kalenteri). Toimitukset, merkinnät, tehtävät ja vapautumiset ilmestyvät samaan kalenteriin Zoom-palaverien kanssa ja pysyvät ajan tasalla itsestään.

**Testipolku (kaksi työnjohtajaa tai työnjohtaja + johtaja):**
1. Työnjohtaja A: Resursointi → työmaan solun + → valitse asentaja (näet "vapaana"/työmaan nimen) → Ehdota. Chip näkyy katkoviivalla.
2. Työnjohtaja B (toinen selain): sama taulu → napauta ehdotusta → kokeile Vastusta syyllä → chip poistuu taulusta (pysäytetty). Tee uusi ehdotus ja paina Vahvista heti.
3. Asentajana: etusivulla näkyy "Seuraava työmaa" -kortti (vain varmistetusta).
4. Oma viikko: aseta jollekin työmaan materiaalille hälytysraja saldoa suuremmaksi (työmaapaneelista) → punainen hälytys ilmestyy → paina "→ tehtäväksi" → tehtävä ilmestyy tämän päivän riville → ruksaa tehdyksi.
5. Tarpeet-välilehdellä (etusivu) aseta jollekin käsittelyssä olevalle tarpeelle toimituspäivä → se näkyy Oman viikon päivärivillä ja kuukausikalenterissa.
6. Kuukausi → Kopioi kalenterilinkki → lisää puhelimen kalenteriin → tapahtumat näkyvät (päivitys voi kestää kalenterisovelluksesta riippuen tunteja).

Maanantaisin klo 7 työnjohto saa push-koosteen jos ehdotuksia odottaa. Ehdotukset varmistuvat automaattisesti 10 min välein ajastetulla tarkistuksella kun 24 h täyttyy.

## 0. UUTTA: Viimeistelykierros (asentajan navigointi uusiksi)

Tämä kierros perustuu saatuun arviointiin (7/10): selkeämpi navigointi, kevyempi etusivu, nopeampi avaus, isommat napit.

**Asentajan alapalkki** — puhelimen alareunassa on nyt neljä pysyvää välilehteä:

| Välilehti | Mitä tekee |
|---|---|
| **Työmaat** | Etusivu: GPS-tunnistus, viikkosaldo, työmaalista |
| **Kirjaa** | Päiväkirjaus — "mikä oli päivän saldo" -pikanapit |
| **Työkalut** | Työkaluseuranta |
| **Lisää** | Kaikki muu: Laskin+, Raportti, Varastohaku, Ajopäiväkirja, Arkisto, Ilmoitukset, vapautumisilmoitus, uloskirjautuminen |

**Etusivu kevennetty kolmeen asiaan:** GPS-kortti, viikkoyhteenveto ja työmaalista. Vanhat napit (Laskin+, Raportti, Varastohaku, Ajopäiväkirja, Arkisto, Työkalut, vapautuminen) löytyvät nyt alapalkista tai **Lisää**-välilehdeltä — mikään ei kadonnut, kaikki vain siirtyi. Uloskirjautuminen on Lisää-välilehden alimpana.

**Nopeampi avaus:** sovellus on pilkottu osiin — aloituspaketti putosi n. kolmasosaan (PDF- ja Excel-kirjastot latautuvat vasta kun nappia painaa). Loput osat esiladataan taustalla heti avauksen jälkeen, joten offline-käyttö toimii kuten ennenkin.

**Isommat kosketusalueet:** ikoninapit ovat nyt vähintään 44 px — hanskakäteen sopivat.

**Testaa erityisesti:**
1. Alapalkin neljä välilehteä puhelimella — löytyykö kaikki vanha Lisää-näkymästä?
2. Lisää → "Ilmoita vapautuminen" → aukeaako sama ilmoitusikkuna kuin ennen etusivulla?
3. Avausnopeus puhelimella (incognito tai välimuistin tyhjennys) — tuntuuko nopeammalta?
4. Raportti → PDF- ja Excel-lataus — toimivatko yhä (kirjastot ladataan nyt lennossa)?
5. Mittauspöytäkirjan QR-hyväksyntä — QR-koodi piirtyy yhä?
6. Lentokonetila päälle ~10 s avauksen jälkeen → kulje välilehdet läpi — aukeavatko kaikki (esilataus)?

HUOM työnjohtaja/johtaja/varasto: näkymät ennallaan, ei alapalkkia — muutos koskee vain asentajaa (+ isommat napit kaikilla).

## 2. Testitunnukset

| Rooli | Sähköposti | Salasana |
|---|---|---|
| Asentaja | asentaja@test.fi | Testi123! |
| Työnjohtaja | tyonjohtaja@test.fi | Testi123! |
| Varasto | varasto@test.fi | Testi123! |
| Johtaja | johtaja@test.fi | Testi123! |

Vinkki: käytä kolmea eri selainta/ikkunaa (esim. normaali + incognito + puhelin), niin näet kaikki kolme roolia yhtä aikaa.

## 3. UUSI: Tarve → tilaus -ketju (pääasia huomenna)

**Asentajana** (puhelin):
1. Avaa työmaa → paina **"Tarvitsen lisää"**.
2. Valitse materiaali napista tai kirjoita vapaasti (esim. "Liimaa 2 astiaa").
3. Kokeile **KIIRE**-kytkintä ja lisätietokenttää → **Lähetä tarve**.
4. Tarkista että tarve näkyy työmaasivulla omassa listassa tilalla "Avoin".

**Työnjohtajana** (toinen selain):
1. Etusivulla pitäisi näkyä **Tarpeet**-välilehti ja punainen lukumäärä. KIIRE-tarpeet ylimpänä.
2. Avaa tarve → neljä nappia: **Hoidan itse / Varastoon / Tilaa toimittajalta / Hylkää**.
3. Kokeile **Tilaa toimittajalta** → paina **Tilausviesti** → tarkista että viestissä on valmiina työmaan nimi, osoite, tuote, määrä ja kiireellisyys. Kokeile **Kopioi** ja **Jaa**.
4. Merkitse **Tilattu** → myöhemmin **Toimitettu**.
5. Lista päivittyy itsestään n. 15 s välein — kokeile: asentaja lähettää uuden tarpeen ja odota että se ilmestyy ilman sivun päivitystä.

**Varastona** (kolmas selain):
1. Työnjohtaja reitittää jonkin tarpeen **Varastoon**.
2. Varaston etusivulle ilmestyy keräilyjono → **Kerätty/lähtee varastolta** → **Toimitettu työmaalle**.

**Asentajana lopuksi:** tarpeen tila työmaasivulla muuttui (Avoin → Hyväksytty → Tilattu → Toimitettu).

## 3b. UUSI: Peukalokirjaus (työmaasivun alapalkki)

Työmaasivun alareunassa on nyt kiinteä peukalopalkki: **Urakka** ja **Tunnit**. Kaikki napit peukalon ulottuvilla, puhelin yhdessä kädessä.

**Urakka** (3 painallusta):
1. Paina **Urakka** → omat pikavalinnat ja tähtikoodit isoina nappeina.
2. Valitse → jättinumeronäppäimistö. Summa (€) päivittyy näytölle sitä mukaa kun näppäilet. Materiaalin vähennyksen voi valita pikkunapeista (valinnainen).
3. Paina **Tallenna X €** → valmis. Hitsaus 50 % lasketaan paketeissa automaattisesti, päivämäärä on aina tämä päivä.

**Tunnit** (2 painallusta):
1. Paina **Tunnit** → tuntityyppi (oletus Asennus) + Kuitattava/Oma.
2. Paina pikatuntinappia (0,5 / 1 / 2 / 4 / 7,5 / 8 h) → **tallentuu heti**, ei erillistä tallenna-nappia.

Testaa: molemmat kirjaukset ilmestyvät kirjauslistaan ja summat täsmäävät tavallisen urakkalomakkeen kanssa. Kokeile myös yhdellä kädellä puhelimessa — se on koko homman pointti.

## 3c. UUSI: Hyväksyntäketju (kirjaukset ↔ mittauspöytäkirja)

Kirjaukset kytkeytyvät nyt mittauspöytäkirjaan, ja mestarin allekirjoitus lukitsee ne pysyvästi — myös tietokantatasolla.

**Testipolku:**
1. Asentajana: tee työmaalle pari urakka- ja tuntikirjausta.
2. Avaa Mittauspöytäkirjat → uusi pöytäkirja → **Hae kirjauksista**. Ilmoitus kertoo montako kirjausta kytkettiin. Työmaasivulla noihin riveihin ilmestyy keltainen **Pöytäkirjassa**-merkki.
3. Hyväksytä pöytäkirja (QR toisella laitteella tai omalla laitteella) → rivit muuttuvat vihreiksi: **✓ Hyväksytty**.
4. Yritä muokata tai poistaa hyväksyttyä kirjausta → estyy ilmoituksella. (Esto on myös tietokannassa asti — edes admin-SQL ei läpäise sitä.)
5. Tee uusi pöytäkirja samalle jaksolle → **Hae kirjauksista** tuo vain vapaat kirjaukset, EI jo pöytäkirjassa olevia. Sama työ ei siis voi tulla palkkaan kahdesti.
6. Poista luonnos-pöytäkirja → sen kirjaukset vapautuvat takaisin.

**Raportissa:** ylimpänä uusi kortti: vihreä **Hyväksytty €** ja keltainen **Odottaa hyväksyntää €** -jako, sekä nappi **"Näytä vain mestarin hyväksymät"** — kun se on päällä, myös KAIKKI lataukset (PDF, Excel, Heikkinen-tililappu) sisältävät vain hyväksytyt kirjaukset. Tämä on se "vain hyväksytyt palkkaan" -portti.

Valmis esimerkki: Demonkuja 5:llä on yksi kirjaus valmiiksi kytkettynä lukittuun pöytäkirjaan 100001 — sen pitäisi näkyä heti ✓ Hyväksytty -merkillä.

## 3d. UUSI: Palkanjako urakkaporukalle (QR-imurointi)

Mattomiehet tekevät usein pareittain — nyt palkan voi jakaa 2–4 miehen porukalle QR-koodilla.

**Testipolku (tarvitset kaksi kirjautunutta laitetta/selainta):**
1. Asentajana (laite 1): työmaasivu → Omat kirjaukset → **Jaa palkka**.
2. Valitse **2 miestä** → näet jaettavien kirjausten määrän, kokonaissumman ja osuuden/mies → **Luo jako ja näytä QR**.
3. Toisella laitteella: kirjaudu toisella asentajatunnuksella (esim. luo uusi tai käytä tyonjohtaja@test.fi — jaon voi imuroida kuka tahansa kirjautunut paitsi jakaja itse) ja skannaa QR kameralla tai avaa kopioitu linkki.
4. Imurointisivu näyttää: kuka jakaa, mikä työmaa, osuutesi € → **Imuroi osuuteni**.
5. Tarkista molemmilla: jakajan kirjausten summat puolittuivat, imuroijalle ilmestyi omat kirjaukset samoilla TES-riveillä → näkyvät hänen raportissaan ja tililapussaan.
6. Laite 1:n jako-ikkunassa näkyy live: "X imuroi osuutensa" (päivittyy ~4 s).
7. Kokeile huijausta: yritä imuroida sama jako uudelleen → "Olet jo imuroinut osuutesi".
8. Mittauspöytäkirja: luo uusi pöytäkirja tälle työmaalle → **Työntekijät-kenttä esitäyttyy koko porukan nimillä**.

Säännöt: vapaat urakkakirjaukset jaetaan aina; **kuitatut tunnit** saa mukaan valinnalla "Jaa myös kuitatut tunnit" (oletuksena päällä) — tunnit siirtyvät TUNTEINA ja jokainen saa niistä palkan OMALLA tuntipalkallaan, joten euromäärä voi erota miesten välillä. Omat tunnit eivät kuulu jakoon. Osuudet aina tasan (50/50, 33/33/33, 25×4), jako vanhenee 24 h, hyväksytyksi ehtinyt kirjaus ohitetaan imuroinnissa automaattisesti.

Tuntijaon lisätesti: kirjaa 8 h kuitattavaa → jaa 2 miehelle tunnit mukana → jakajalle jää 4 h ja imuroijalle tulee 4 h omiin kirjauksiin; kummankin raportissa tunnit kerrotaan omalla tuntipalkalla.

## 3e. UUSI: Mestarin palaute (näkyy vain työnjohdolle)

QR-hyväksynnän jälkeen mestarille avautuu vapaaehtoinen palautekortti: **tähdet 1–5 + viesti Heikkiselle**. Kyse on viestistä firmalle toimituksesta — asentajasta ei kysytä mitään, eikä palaute näy asentajalle koskaan (esto on tietokannan RLS-tasolla, ei vain käyttöliittymässä).

**Testipolku:**
1. Tee mittauspöytäkirjan QR-hyväksyntä normaalisti (osio mittauspöytäkirja).
2. Allekirjoituksen jälkeen "Hyväksytty ja lukittu" -ruudun alla: anna esim. 4 tähteä + viesti → **Lähetä palaute** → "Kiitos palautteesta!".
3. Kirjaudu työnjohtajana → etusivulla uusi **Palaute**-välilehti: keskiarvo + lista (tähdet, viesti, työmaa, mestari, aika).
4. Tarkista piilotus: asentajan sovelluksessa palautetta ei näy missään — eikä sitä saa kannasta asentajan tunnuksilla edes selaimen kehittäjätyökaluilla.
5. Palautteen voi antaa vain kerran per pöytäkirja ja 2 h sisällä allekirjoituksesta.

## 3f. UUSI: Työkaluseuranta (QR-tarrat + skannaa ja siirrä)

Jokainen työkalu on yksilö, jolla on sijainti ja historia — paperilaput jäävät historiaan.

**Testipolku:**
1. Varastona (tai työnjohtajana): etusivun **Työkalut**-nappi → **+** → valitse esim. "Hiomakone" → saa automaattisesti numeron (#1) → lisää pari muutakin (Imuri, Tasoitesekoitin).
2. Paina **tulostinkuvaketta** → latautuu PDF-tarra-arkki (A4, 24 tarraa/sivu): QR + nimi + numero. Tämä liimataan koneisiin.
3. Asentajana: etusivulla uusi **Työkalut**-kortti → avaa listan. Napauta työkalua → **Otan mukaan** → tila muuttuu "Asentajalla" ja etusivun kortti näyttää "Sinulla kuitattuna 1 työkalua".
4. Työmaalla: napauta työkalua → **Vie / jätä työmaalle** → valitse työmaa → työkalu näkyy nyt työmaasivulla "Työkalut työmaalla" -osiossa — ja varasto näkee saman.
5. Skannaustesti: skannaa tulostettu/ruudulta QR puhelimen kameralla → linkki avaa sovelluksen suoraan kyseisen työkalun siirtonäkymään. Yksi skannaus + yksi nappi = siirto kirjattu.
6. **Ilmoita kadonneeksi** → työkalu näkyy punaisella "Etsinnässä"-suodattimessa, ja historiasta näkyy kuka sen viimeksi kuittasi ja minne. **Löytyi!** palauttaa varastoon.
7. Historia: jokaisen työkalun kortissa näkyy koko liikeketju (kuka, mitä, milloin, mille työmaalle) — eikä sitä voi muokata jälkikäteen.

Suodattimet: Varastossa / Työmailla / Asentajilla / Etsinnässä / Minulla + haku. Varaston kuskit näkevät yhdellä silmäyksellä minkä työmaan kalusto on missäkin.

## 3g. UUSI: Varastohaku (hyllynreuna-QR:t + pikanapit → laskutettava pino)

Paperilappujen korvaaja: kuka haki, mitä, kuinka paljon ja mille työmaalle — ja kaikki suoraan työnjohtajan laskutettavaan pinoon.

**Testipolku:**
1. Asentajana: etusivun **Varastohaku**-nappi → tuotepikanapit (Mattoliima, Tasoite, Primer, Hitsauslanka, Jalkalista, Saumamassa valmiina katalogissa).
2. Napauta tuotetta → pikamäärät 1–10 tai numeronäppäimistö → valitse työmaa → **Kirjaa haku**. Kolme painallusta parhaimmillaan.
3. Varastona/työnjohtajana: **tulostinkuvake** → latautuu iso hyllytarra-arkki (A4, 8 tarraa/sivu: iso QR + tuotenimi). Nämä liimataan hyllyn reunaan tai varaston seinään.
4. Skannaustesti: skannaa hyllytarran QR kameralla → sovellus aukeaa tuote valmiiksi valittuna → määrä + työmaa → valmis.
5. Työnjohtajana: etusivulla uusi **Haut**-välilehti lukumäärämerkillä → haut ryhmiteltynä työmaittain (tuote, määrä, kuka, milloin) → **Merkitse laskutetuksi** siivoaa pinon työmaa kerrallaan (kirjausjälki säilyy).
6. Palautukset: sama nappi, valitse "Palautan varastoon" → ei mene laskutuspinoon, mutta jää kirjausjälkeen.
7. Bonus: haettu tavara ilmestyy myös työmaasivun Materiaalit-listaan saldona.

Tuotteiden hallinta (+-nappi): vain varasto ja työnjohto. Hakuja ei voi poistaa — kirjausjälki on pysyvä.

## 3h. UUSI: Arkisto — "minkä väristä listaa sinne asennettiin?"

Yksi haku joka löytää KAIKEN, myös vuoden vanhoilta ja valmistuneilta työmailta: mittauspöytäkirjat, tilaukset, varastohaut, materiaalisaldot, työkirjaukset, huonemerkinnät kuvineen, työkalutapahtumat, mestaripalautteet — ja itse arkistoidut dokumentit/kuvat hakusanoineen.

**Testipolku:**
1. Etusivun **Arkisto**-nappi (kaikilla rooleilla; työmaasivulla arkistokuvake avaa valmiiksi sen työmaan).
2. Kirjoita hakuun esim. `jalkalista` → tuloksissa näkyy tilaukset, varastohaut ja dokumentit joissa sana esiintyy, työmaan nimi ja päivämäärä vieressä. Monisanahaku toimii: `jalkalista tammi` löytää vain rivit joissa molemmat.
3. Työmaasuodatin: valitse valmistunut työmaa (✓-merkitty) → koko historia aikajärjestyksessä. Tämä on se takuukorjaustilanne.
4. Tyyppisuodattimet: Dokumentit / Pöytäkirjat / Tilaukset / Haut / Materiaalit / Kirjaukset / Huoneet / Työkalut / Palaute.
5. **+**-napista arkistoi mitä vain: otsikko, tyyppi (dokumentti/kuva/mittapöytäkirja/tilaus/toimitus/korjaus/muistiinpano), työmaa, **hakusanat pilkulla** (esim. `jalkalista, tammi, 2krs, takuu`), lisätiedot ja liite (kuva tai PDF puhelimen kamerasta/tiedostoista).
6. Liitteet aukeavat ulkoisen linkin kuvakkeesta (turvallinen tunnin voimassa oleva linkki — tiedostot eivät ole julkisia).
7. Vinkkikäytäntö porukalle: kun asennat jotain minkä väri/malli/erä pitää muistaa, ota kuva ja arkistoi hakusanoilla. 30 sekuntia nyt säästää tunnin soittelun vuoden päästä.

Kuka saa mitä: kaikki näkevät ja arkistoivat, muokkaus/poisto vain työnjohto. Arkisto ei tyhjene koskaan — valmistunut työmaa säilyy hakukelpoisena ikuisesti.

## 3i. UUSI: Työmaakansio — se kättäpidempi johtajille

Työmaan pysyvä muisti: mitä tuotteita asennettiin (**väri, malli/koodi, eränumero, toimittaja, määrä, sijainti, toimituspäivä**) + työmaan dokumentit ja päätökset (tarjouspyynnöt, aloituspalaverit, päätökset, sopimukset) + koko paketti ulos yhtenä **PDF-luovutuskansiona**.

**Testipolku:**
1. Avaa työmaa → yläpalkin **kansiokuvake** (keltainen) → Työmaakansio.
2. **Kirjaa tuote**: kategoria (matto/vinyyli/parketti/jalkalista/liima/tasoite…), tuote, väri, koodi, erä, toimittaja, määrä, sijainti ("2. krs käytävät"), toimituspäivä, lisätiedot. Esim: *Tarkett iQ Granit, Harmaa 429, erä 2214B, 120 m², 2. krs.*
3. Tuotekortit näkyvät kansiossa hakuineen — hae vaikka `harmaa` tai `2214`.
4. **Dokumentit ja päätökset** -osio näyttää kaikki tälle työmaalle arkistoidut dokumentit; "Arkistoi uusi →" vie Arkistoon jossa uudet tyypit: tarjouspyyntö, aloituspalaveri, päätös, sopimus.
5. **Tulostinkuvake** → latautuu siisti PDF: kansilehti työmaan tiedoilla, osa 1 tuotteet väreineen ja erineen, osa 2 dokumenttiluettelo, sivunumerot. Tämä on se dokumentti jonka rakennusliike haluaa luovutuksessa — ja jonka takuukorjaaja haluaa vuoden päästä.
6. Tuotteet löytyvät myös Arkiston yleishausta (uusi Tuotteet-suodatin): haku `jalkalista tammi` löytää tuotekortin miltä tahansa työmaalta.

**Demopolku johtajille (2 min):**
1. "Vuoden vanha työmaa, takuukorjaus, minkä väristä listaa?" → Arkisto → hae `jalkalista` → vastaus 5 sekunnissa.
2. Avaa Työmaakansio → näytä tuotekortit → paina tulostinta → ojenna PDF-luovutuskansio.
3. "Ja tämä syntyy siinä sivussa: asentaja kirjaa haun varastolla kolmella painalluksella, työnjohtaja saa laskutettavan pinon valmiina."

Kuka saa mitä: kaikki näkevät ja kirjaavat tuotteita, muokkaus/poisto vain työnjohto. Avoimet kysymykset johtajille: mitkä dokumentit halutaan pakollisiksi (aloituspalaverimuistio?), kuka vastaa tuotekirjauksesta toimituksen yhteydessä, ja arkistoidaanko myös tarjouspyynnöt keskitetysti.

## 3j. UUSI: Tilin luonti + hyväksyntäportti

Kirjautumissivulla on **Luo tili** -välilehti: koko nimi, sähköposti, salasana (väh. 6 merkkiä). Mutta uusi tili **ei pääse mihinkään** ennen kuin työnjohto hyväksyy sen:

1. Uusi käyttäjä rekisteröityy → näkee "Odottaa työnjohdon hyväksyntää" -sivun. Tietokantataso (RLS) estää kaiken datan näkymisen — ei työmaita, ei kirjauksia, ei mitään.
2. Sinä (työnjohtaja/johtaja) → etusivun yläpalkin **käyttäjäkuvake** → **Käyttäjät**-sivu → odottavat tilit keltaisella reunuksella → valitse rooli (asentaja/työnjohtaja/varasto/johtaja) → **Hyväksy**.
3. Käyttäjä painaa "Tarkista uudelleen" tai kirjautuu uudelleen → sovellus aukeaa.

Samalta sivulta myös: roolin vaihto milloin vain (ei enää Supabase-paneelia!) ja **Poista oikeudet** joka lukitsee tilin heti (kirjaukset säilyvät). Omaa rooliaan ei voi muuttaa, eikä kukaan voi korottaa omia oikeuksiaan — tietokantatriggeri estää sen vaikka joku yrittäisi ohi sovelluksen.

**Testipolku (tee tämä pojan kanssa):** Poika luo tilin puhelimellaan → näkee odotussivun → sinä hyväksyt Käyttäjät-sivulta → poika painaa "Tarkista uudelleen" → sisällä.

**Sähköpostivahvistus:** Jos Supabasessa on "Confirm email" päällä (Authentication → Sign In / Providers → Email), tulee hyväksynnän lisäksi sähköpostin vahvistuslinkki. Kahdelle hengelle sujuvinta on kytkeä se pois — hyväksyntäportti hoitaa turvan.

## 3k. UUSI: Kotinäyttöasennus, johtajan koontinäkymä ja demoaineisto

**Kotinäyttöasennus (PWA):**
- Android/Chrome: avaa sovellus → valikko (⋮) → **Asenna sovellus** (tai osoiterivin asennuskuvake). iPhone/Safari: **Jaa → Lisää Koti-valikkoon**.
- ProFloor-kuvake ilmestyy kotinäytölle ja sovellus aukeaa koko ruudulla ilman selainpalkkeja. Päivitykset tulevat silti aina heti deployn jälkeen — mitään ei jää välimuistiin jumiin.

**Johtajan koontinäkymä:**
- Johtaja-roolin etusivu on nyt oma näkymä: viikon tunnit ja urakkaeurot (ma–su), laskuttamattomat haut ja avoimet tarpeet (keltainen reunus = vaatii toimia, napautus vie työnjohdon näkymään), työmaat kokonaissummineen, pikalinkit ja mestaripalautteen keskiarvo.
- Testaus: vaihda oma roolisi hetkeksi → Käyttäjät-sivu ei salli oman roolin vaihtoa, joten tee testijohtaja: luo uusi tili → hyväksy se johtaja-roolilla → kirjaudu sillä.

**Demoaineisto:**
- Kannassa on nyt **DEMO Kauppakeskus Valo** (Rakennusliike Kivi Oy): tuotekortit väreineen ja erineen (Tarkett iQ Granit, Harmaa 429, erä 2214B…), varastohakuja laskutuspinossa, avoin kiiretarve, arkistossa aloituspalaveri + päätös + takuukorjaus, ja tämän viikon kirjauksia jotka näkyvät johtajan luvuissa.
- Esittelyssä: hae Arkistosta `jalkalista` tai `harmaa` → tulos sekunneissa. Avaa Työmaakansio → tulosta PDF.
- **Siivous kun demo on ohi** (Supabase → SQL Editor):
  ```sql
  delete from entries where worksite_id in (select id from worksites where name like 'DEMO %');
  delete from archive_items where worksite_id in (select id from worksites where name like 'DEMO %');
  delete from material_pickups where worksite_id in (select id from worksites where name like 'DEMO %');
  delete from material_requests where worksite_id in (select id from worksites where name like 'DEMO %');
  delete from worksite_products where worksite_id in (select id from worksites where name like 'DEMO %');
  delete from materials where worksite_id in (select id from worksites where name like 'DEMO %');
  delete from worksites where name like 'DEMO %';
  ```

## 3l. UUSI: GPS-työmaatunnistus, esitiedot, ajopäiväkirja ja offline

**GPS-työmaatunnistus (vapaaehtoinen!):**
- Asentajan etusivulla on "Ota työmaan tunnistus käyttöön" -nappi. Se kysyy sijaintiluvan ja tallentaa valinnan — GPS toimii VAIN kun äppi on auki, taustaseurantaa ei ole eikä selain sitä edes salli. Tämä ei ole kyttäystyökalu ja se kannattaa sanoa porukalle suoraan.
- Kun äppi avataan työmaalla (työmaalle annettu sijainti, oletussäde 250 m), etusivulle nousee keltainen kortti: **"Olet työmaalla X"** + suora pääsy kirjaamaan, mestarin numero (soitto yhdellä painalluksella), perehdytyslinkki, pohjakuva ja navigointi. Työmaavalikkoa ei tarvitse avata.
- Samalla syntyy käyntilokimerkintä (päivä + työmaa) tuntilappua varten.

**Uusi työmaa esitietoineen (työnjohtaja):**
- Työmaat-välilehti → **"Uusi työmaa esitietoineen"**: nimi, osoite, tilaaja, mestarin nimi + puhelin, perehdytyslinkki, erityismaininnat, GPS-sijainti (liitä Google Maps -linkki TAI paina sijaintinappia työmaalla seistessä) ja pohjakuva (menee myös arkistoon).
- Testi: luo työmaa jonka sijainniksi annat nykyisen sijaintisi → avaa äppi asentajana samassa paikassa → kortti nousee.

**Tuntilappu-Excel — missä oltiin minäkin päivänä:**
- Raportti → Heikkisen tililappu: Tuntilappu-välilehti listaa nyt jokaiselle päivälle KAIKKI työmaat joilla oltiin — kirjauksista JA GPS-käynneistä. Kaksi työmaata samana päivänä = kaksi riviä. Jos päivältä on vain GPS-käynti ilman kirjauksia, riville tulee merkintä "käynti (GPS)".

**Ajopäiväkirja (km-korvaukset):**
- Etusivun **Ajopäiväkirja**-nappi. Ensin "Tallenna kotipiste" (paina kotona) → sen jälkeen koti ↔ työmaa -ajojen kilometrit lasketaan automaattisesti (tie-arvio: linnuntie × 1,3 — korjaa jos matkamittari näyttää muuta).
- Lisää ajo: päivä, mistä → mihin (pikanapit: Koti + työmaat), km valmiiksi laskettuna, meno-paluu-kytkin (×2), selite. Kuukausikooste näyttää km + korvauksen (€/km muokattavissa, oletus 0,59 — tarkista Verohallinnon vuosipäätöksestä).
- Rehellinen rajaus: selainsovellus ei voi pitää ajopäiväkirjaa taustalla ajon aikana — siksi kirjaus on pisteestä pisteeseen -malli, joka silti täyttää ajopäiväkirjan vaatimukset (pvm, reitti, km, selite).

**Offline:**
- Äppi aukeaa nyt ilman verkkoa (asennettu versio; runko välimuistissa). Supabase-dataa ei välimuistiteta — offline-tilassa listat eivät lataudu, mutta kirjaaminen toimii:
- **Varastohaku ja ajopäiväkirja toimivat offline**: kirjaus tallentuu puhelimeen ja lähtee automaattisesti kun verkko palaa. Yläreunan banneri näyttää tilan: keltainen = ei verkkoa, sininen = jonoa lähetetään.
- Testi: lentokonetila päälle → asenna äppi auki → kirjaa varastohaku → banneri kertoo jonosta → lentokonetila pois → kirjaus lähtee itsestään parissa sekunnissa.

## 3m. UUSI: Työmaakalenteri (viikkopalaverin poistaja) + oma työmaa + työmaapyyntö

**Työmaakalenteri** (työnjohtaja: yläpalkin kalenterikuvake · johtaja: Kalenteri-pikalinkki):
- Yksi ruutu vastaa viikkopalaverin peruskysymyksiin: mitkä työmaat käynnissä, kuka vetää, ketkä siellä ovat, missä vaiheessa, koska valmistuu — ja ylimpänä **"Vapautumassa 14 päivän sisällä"**, eli juuri se jota palaverissa aina kysytään.
- Jokaisella työmaalla aikajanapalkki (7 viikon ikkuna, tänään-viiva) + valmius-%. Väri kertoo tilanteen: vihreä = aikataulussa, keltainen = valmius jäljessä aikataulusta, punainen = arvioitu valmistuminen ylitetty.
- **Miehitys päättyy automaattisesti**: viimeisen 7 pv GPS-käynnit ja kirjaukset kertovat ketkä ovat työmaalla — kenenkään ei tarvitse ylläpitää listaa käsin. (Verrokkisovellukset vaativat käsin tehdyt resursointitaulut — meillä kenttä täyttää sen itse.)
- Työnjohtaja napauttaa työmaata → valmius-% pikanapit, alkamis- ja valmistumispäivä, vastaava työnjohtaja.

**Asentajan vapautumisilmoitus:**
- Etusivun "Ilmoita koska vapaudut työmaalta" → työmaa + päivä + **Varma tieto / Arvio** -kytkin + lisätieto ("riippuu tasoitteen kuivumisesta").
- Näkyy heti kalenterissa asentajan nimen perässä (esim. "Matti → 21.8.?" = arvio). Uusi ilmoitus korvaa vanhan.

**Oma työmaa ja työmaapyyntö (asentaja):**
- Etusivun Työmaat-otsikon vieressä **"Työmaa puuttuu?"**:
  - **Pyydä työnjohdolta**: pyyntö ilmestyy työnjohtajan Työmaat-välilehdelle keltaisella reunuksella (+ lukumäärä välilehdessä) → Hyväksy työmaaksi / Hylkää. Hyväksytty työmaa tulee kaikille näkyviin.
  - **Oma työmaa**: heti käytettävissä kirjauksiin, merkitty "oma"-tunnisteella — omiin keikkoihin, ei työnjohdon putkessa.

**Verrokkitutkimuksesta poimitut palat:** yhden ruudun resurssitaulu (Assignar), aikajana + valmius yhdessä (Buildertrend/SmartPM), liikennevalovärit tilanteesta, ja kentältä johdettu läsnäolo jota missään verrokissa ei ollut automaattisena — se on meidän etu.

## 3n. UUSI: Palkkakatko-apuri (työnjohtajan tarkastuksen tuki)

Palkkakatkopäivän painajaisen poistaja: yläpalkin **seteli-kuvake** (työnjohtaja) tai Palkkakatko-pikalinkki (johtaja). Näyttää kuluvan palkkakauden automaattisesti.

**Kolme osaa:**
1. **Tarkista nämä** — apuri liputtaa poikkeavat rivit perusteineen, numerot näkyvissä:
   - *Harvinainen*: rivi jota asentaja ei ole ennen käyttänyt ja jota harva muukaan käyttää (se "jyräys palkkalapussa" -tapaus)
   - *Määräpiikki*: määrä yli 2× asentajan oma mediaani samalle koodille
   - *Aiheeton ennen* (punainen): rivi joka on aiemmin todettu aiheettomaksi
2. **Kuitattavat tunnit (firman miinus)** — "Heikkinentunnit" per asentaja: palkki, vertailu omaan kausikeskiarvoon (nuoli ylös/alas) ja tiimin keskiarvoon. Poikkeavan korkea korostuu.
3. **Toistuvat tuntisyyt** — sama selite kaudesta toiseen ("siivous", "odottelu") nostetaan esiin: toistuva syy on usein prosessiongelma, ei palkka-asia.

**Oppiva tarkastus — näin se oppii:**
- Jokaisessa lipussa napit **"OK, kuului maksaa"** ja **"Aiheeton"**.
- Kahdesti OK-kuitattu rivi (sama asentaja + koodi) ei liputa enää → apuri hiljenee sitä mukaa kun se oppii talon tavat.
- Kerrankin aiheettomaksi merkitty liputetaan jatkossa aina punaisella.
- Ei mustaa laatikkoa: jokainen lippu kertoo täsmälleen millä numeroilla se syntyi. Apuri ehdottaa — työnjohtaja päättää.

**Testipolku:** kirjaudu työnjohtajana → seteli-kuvake → demoaineiston kirjauksista pitäisi nousta ainakin yksi lippu → paina "OK, kuului maksaa" → lippu saa päätösmerkinnän (ja sama rivi ei liputa tulevilla kausilla toisen OK:n jälkeen).

## 3o. UUSI: Puuttuvan pisteen setti — testit, offline kaikkiin kirjauksiin, virheloki

**Automaattitestit rahalaskuille:**
- 31 testiä kriittisimmille laskuille: palkkakauden rajat (myös vuodenvaihde), desimaalipilkut, euromuotoilu, km-laskenta ja koordinaattien jäsennys, tililappupohjan nimikekartan eheys, hitsauskoodien tunnistus (1104-tekstiililaatta ei ole hitsausta!).
- Ajo: projektikansiossa `npm test`. Aja aina ennen deployta jos rahalaskuihin on koskettu.

**Offline nyt myös työkirjauksissa:**
- Urakka-, vapaa urakka-, tunti- ja peukalokirjaukset tallentuvat ilman verkkoa ja lähtevät automaattisesti verkon palatessa (sama jono kuin varastohaulla ja ajoilla).
- Huom: offline-urakka ei vähennä työmaan materiaalisaldoa automaattisesti — saldo elää vasta verkossa tehdyistä kirjauksista.

**Virheloki:**
- Kaikki kaatumiset ja käsittelemättömät virheet tallentuvat kantaan (`app_errors`): kuka, mikä sivu, mikä virhe, millä laitteella. Sama virhe kirjataan vain kerran per istunto — ei tulvaa.
- Kun joku sanoo "se vaan lakkasi toimimasta", vastaus löytyy Supabasesta: Table Editor → app_errors (tai kysy Claudelta, luen sen sieltä suoraan).

**Hälytyslinjaus (sovittu, ei vielä rakennettu):** välitön hälytys vain jos joku seisoo (kiiretarve). Kaikki muu välilehtien lukumäärämerkeissä. TES tulee sovellukseen aikanaan hakuteoksena, ei tuomarina — palkkapäätökset tekee aina ihminen, ja Linjaukset-muisti pitää ne yhdenmukaisina.

## 3p. UUSI: Push-ilmoitukset (kiirehälytys + ajastettu päiväsaldo)

Sovitun linjauksen mukaisesti: **hälytys vain jos joku seisoo** + jokaisen itse säätämä ajastettu saldo. Ei mitään muuta piippausta.

**Käyttöönotto (laitekohtainen):**
1. Yläpalkin **kellokuvake** → Ilmoitukset → "Ota ilmoitukset käyttöön" → salli selaimen kysyessä.
2. **iPhone-erikoisuus:** push toimii VAIN kotinäytölle asennetussa äpissä (Jaa → Lisää Koti-valikkoon, avaa kuvakkeesta). Androidilla toimii suoraan selaimessakin, mutta asennettu äppi on luotettavin.

**Kiirehälytys (vain työnjohto/johtaja):**
- Kun asentaja lähettää KIIRE-merkityn tarpeen, työnjohtajan puhelin saa push-ilmoituksen heti: tuote, työmaa, pyytäjä. Päälle/pois-kytkin Ilmoitukset-sivulla.
- Testi: asentajatunnuksella tee kiiretarve → työnjohtajan puhelin kilahtaa parissa sekunnissa (myös äppi kiinni).

**Päivän saldo (kaikki roolit, oma ajastus):**
- Päälle/pois + kellonaika + viikonpäivät erikseen — esim. arkisin klo 15.20: *"Päivän saldo: 342,60 € — urakat 300,00 € + 2 h tunteja (5 kirjausta)"*.
- Jos päivältä ei ole kirjauksia: *"Ei kirjauksia tänään. Muista kirjata ennen kotiinlähtöä!"* — eli sama ilmoitus toimii kirjausmuistuttajana.
- Tarkkuus: lähtee noin valitulla minuutilla (palvelin tarkistaa 5 min välein), kerran päivässä, Suomen aikaa.

**Tekniikka:** lähetys tapahtuu palvelimella (Supabase Edge Function + ajastus), joten ilmoitukset tulevat vaikka äppi ja puhelin olisivat taskussa. Tilaukset ovat laitekohtaisia — sama käyttäjä voi laittaa eri asetukset puhelimeen ja tablettiin.

**Päiväkirjaus — äppi kysyy, sinä vastaat pikanapeilla:**
- Ajastettu ilmoitus on KYSYMYS: *"Mikä oli päivän saldo?"* → napautus avaa suoraan päiväkirjausnäkymän (myös etusivun napista pääsee).
- Vastaaminen: näppäile määrä (esim. 123) → paina työlajipikanappia (esim. Tekstiili) → rivi kertyy listaan → 22 → Kosteat → "Kirjaan tunteja" → Paikkaus + 1 h → **Kirjaa 3 riviä**. Työmaa valitaan kerran (GPS esivalitsee jos paikan päällä).
- Pikanapit ovat OMAT eniten käyttämäsi TES-koodit — äppi oppii ne kirjaushistoriasta. Muut työlajit löytyvät hakukentästä. Jokainen rivi näyttää euromäärän heti ja koko päivän saldo lasketaan valmiiksi.
- Jos päivältä on jo kirjauksia, ilmoitus kertoo montako ja kysyy puuttuuko jotain. Toimii offline — rivit jonottuvat.

## 3q. UUSI: Pelisäännöt (aloituspalaverissa sovittu) + kuittausmuistutus

Ratkaisee sen että "työnjohtajat eivät tiedä mitä tarjouksessa/palaverissa sovittiin" — ja että asentaja tietää mikä kuuluu hänelle:

- Työmaasivulla uusi **Pelisäännöt**-osio (näkyy kaikille rooleille). Työnjohtaja kirjaa aloituspalaverin jälkeen: aikataulu, tyhjennystahti (esim. "2 huonetta/pv edellä"), ja kenelle kuuluvat **lasta-puhtaat tilat / pohjatyöt ja paikkaukset / haalaus** (Asentajalle vai Rakennusliikkeelle -pikanapit), muut sovitut asiat ja palaverin päivämäärä.
- **Tuntikuittausväli**: jos sovitaan esim. 7 pv, äppi muistuttaa vastaavaa työnjohtajaa push-ilmoituksella arkiaamuisin klo 8 kun väli on täynnä: *"Tuntikuittaukset: [työmaa] — sovittu kuittausväli on täynnä."* Muistutuslaskuri nollautuu joka muistutuksesta.
- Testipolku: työnjohtajana avaa työmaa → Pelisäännöt → "+ Kirjaa sovitut" → täytä → tallenna → kirjaudu asentajana → sama työmaa → säännöt näkyvät.

**Roadmap-merkinnät tästä keskustelusta:** (1) Tarjouslaskenta ja työmaiden jakoprosessi = selvitetään johtajilta miten nyt toimii, ennen kuin rakennetaan mitään. (2) **Käännösviestit** (työnjohtaja ↔ vieraskieliset työntekijät, esim. DeepL-käännös lennosta) = vaatii ensin viestitoiminnon — oma kokonaisuutensa kenttäviikon jälkeen.

## 3r. UUSI: Valokuvatodisteet + kuvaraportti ("mikä tämä työ muka on?")

- **Todistekuva yhdellä napilla:** työmaasivun yläpalkin kamerakuvake → kamera aukeaa → ota kuva → kirjoita mitä kuvassa on ("Pohjatyö 2. krs käytävä") → Tallenna pilveen. Kuva menee arkistoon työmaalle nimellä, aikaleimalla ja "todiste"-tagilla — löytyy myös arkistohausta.
- **Kuvaraportti:** Työmaakansio → Kuvaraportti-osio → valitse aikaväli (7 pv / 30 pv / kaikki) → "Luo kuvaraportti" → PDF jossa kuvat isoina, jokaisessa otsikko, päivämäärä ja kuvaaja. Puhelimella aukeaa suoraan jakovalikko → sähköpostiin mestarille puolessa minuutissa. Koneella PDF latautuu.
- Käytäntö riitatilanteeseen: kun rakennusliike kyseenalaistaa laskutetun työn, kuvaraportti valitulta aikaväliltä on todistusaineisto jossa jokainen kuva on aikaleimattu ja tekijöity.
- Testipolku: ota työmaalla 2–3 kuvaa kamerakuvakkeesta → avaa Työmaakansio → Luo kuvaraportti (30 pv) → tarkista PDF.
- Huom: tuntikuittausmuistutus menee nyt ASENTAJALLE (jolla kuitattavia tunteja työmaalla) ja työnjohtajalle tiedoksi — ja jos kuitattavia tunteja ei ole, kukaan ei saa turhaa ilmoitusta.

## 3s. UUSI: "Mestari ei ollut paikalla" — pöytäkirjan eskalointi työnjohdolle

Tukkii sen vuodon jossa lasku jää lähtemättä koska kuittausta ei saatu paikan päällä:

1. Asentaja avaa pöytäkirjan hyväksynnän (QR-näkymä) → mestaria ei näy → uusi nappi **"Mestari ei ollut paikalla — siirrä työnjohdolle"**. Hyväksyntälinkin voimassaolo pitenee samalla viikkoon.
2. Työnjohtajan **Tarpeet-välilehden yläosaan** nousee keltainen kortti: pöytäkirjan numero, kohde, kuka siirsi ja koska (näkyy myös välilehden lukumäärässä).
3. Työnjohtaja painaa **"Kopioi hyväksyntälinkki"** → linkki leikepöydälle → lähettää sen mestarille sähköpostilla/viestillä → mestari avaa ja allekirjoittaa omalla puhelimellaan missä tahansa. Kun allekirjoitus tulee, kortti poistuu automaattisesti.
4. "Hoidettu"-nappi poistaa kortin käsin (jos asia hoitui muuta kautta).

Testipolku: tee pöytäkirja asentajana → QR-näkymä → "Mestari ei ollut paikalla" → kirjaudu työnjohtajana → Tarpeet → kortti näkyy → kopioi linkki → avaa se selaimessa ja allekirjoita → kortti katoaa.

## 4. UUSI: Kirjauksen muokkaus

Huom: hyväksyttyjä (✓) kirjauksia ei voi muokata — kokeile muokkausta vapaalla kirjauksella.

1. Asentajana työmaasivulla: napauta mitä tahansa vanhaa kirjausriviä.
2. Muokkaa määrää ja päivämäärää → Tallenna → summa laskettiin uudelleen oikein?
3. Kokeile myös poisto muokkausikkunasta.

## 5. Regressiotarkistukset (nopeasti läpi)

- **Urakkakirjaus**: pikavalinta + TES-haku ("Eniten käytetyt" -osio ylimpänä hakussa).
- **Pikavalintakirjasto**: luo uusi paketti, kopioi, muokkaa, poista.
- **Hitsauskoodit**: paketti jossa mattoa → hitsaus 50 % neliöistä; 1104 tekstiililaatta EI saa hitsausta.
- **Tuntikirjaus**: tuntityyppinapit + pikatunnit + kuitattava/oma.
- **Laskin**: 1 × 1 nostolla 10 cm → 1,2 × 1,2 = 1,44 m². M+ työmaan materiaalille.
- **Raportti**: **Heikkinen-tililappu (Excel)** -lataus — EI VIELÄ KOSKAAN TESTATTU LATAUKSENA. Avaa Excelissä ja vertaa käsin täytettyyn: nimikkeet oikeissa soluissa, VLOOKUP-hinnat elävät, tuntilappu täyttyi.
- **Mittauspöytäkirja**: uusi pöytäkirja → QR-hyväksyntä toisella laitteella → lukitus → PDF + /varmenna.

## 6. Jos jokin hajoaa

- Valkoinen sivu → kova päivitys (Ctrl+Shift+R / puhelimessa tyhjennä välimuisti).
- Kirjaudu ulos ja sisään jos roolinäkymä näyttää väärältä.
- Ota kuvakaappaus + kellonaika muistiin, niin korjataan yhdessä.
