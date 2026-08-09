# Kriittinen arvio: Asentaja-MVP, asentajanäkymä

*Arvioitu 7.8.2026 — koodikatselmus + sovellus ajettuna mobiilikoossa (390×844) kuvakaappauksineen.*

---

## 1. Mitä sovelluksessa tällä hetkellä on

Koko sovellus on kolme näkymää: kirjautumissivu, roolireititys ja asentajan etusivu. Asentajan etusivu näyttää yläpalkin (ProFloor + nimi + uloskirjautuminen), laskurikortin "Työmaita: N" ja listan aktiivisista työmaista (nimi, osoite, tilaajayritys, "Aktiivinen"-badge). Siinä kaikki. Tietomallissa on jo lupaavia siemeniä (roolit asentaja/työnjohtaja/varasto/johtaja, tuntipalkka, hukkaprosentti, palkkakauden katko), mutta mikään niistä ei vielä näy käyttöliittymässä.

## 2. Toimivuus — kriittiset havainnot

**Sovellus ei tällä hetkellä toimi lainkaan.** Supabase-projekti "Mattomies", johon `.env.local` osoittaa, on pausella (INACTIVE). Ilmaistason projekti nukahtaa käyttämättömänä — oikea käyttäjä näkisi nyt vain ikuisen latauksen tai virheen. Tämä on korjattava ennen kuin mitään muuta kannattaa arvioida kentällä.

**Työmaakortit ovat kuollut pää.** Korteissa on `cursor-pointer`, hover- ja active-tyylit — ne *näyttävät* klikattavilta — mutta niillä ei ole mitään onClick-käsittelijää. Asentaja ei voi avata työmaata, eikä sovelluksessa ole yhtään toimintoa: ei tuntikirjausta, ei kuittausta, ei valokuvia, ei mitään. MVP:n ydinlupaus ("asentaja voi tehdä X:n puhelimellaan") puuttuu kokonaan.

**Monivuokraajasuodatus puuttuu.** Työmaahaku suodattaa vain `status = 'active'` — ei `organization_id`:llä eikä asentajakohtaisilla kohdennuksilla. Jokainen asentaja näkee kaikki työmaat. Jos RLS-politiikat eivät ole kunnossa (en päässyt varmistamaan, koska kanta on pausella), tämä on suoraan tietoturvareikä: yritys A näkee yrityksen B työmaat. Tämä on varmistettava heti kun kanta herää.

**Virhetilanteet ovat raakileita.** Supabasen englanninkielinen virheteksti näytetään käyttäjälle sellaisenaan, uudelleenyritystä ei ole, ja jos profiilin haku epäonnistuu kirjautumisen jälkeen, käyttäjä jää umpikujaruutuun. Työmaaolosuhteissa (kellarit, betonirungot, huono kenttä) verkko katkeilee jatkuvasti — offline-tilannetta ei ole mietitty lainkaan.

**Koodissa on kehitysvaiheen roskaa:** konsoli-lokitukset (`[fetchProfile] Aloitetaan haku...`) tuotantokoodissa, testitunnukset painettuna kirjautumissivulle, README on koskematon Vite-pohja, sivun otsikko on "asentaja-mvp" ja `lang="en"` vaikka sovellus on suomeksi. Lucide-ikonikirjasto on asennettu mutta sitä ei käytetä missään. `hover:bg-gray-750` on luokka jota Tailwindissa ei ole olemassa — se ei tee mitään.

## 3. Graafinen ja visuaalinen arvio: AI slop vai Huikea?

**Tuomio: ei kumpaakaan — "siisti geneerinen", mutta kirjautumissivu kallistuu sloppiin.**

Asentajan etusivu on kelvollista, siistiä perus-Tailwindia: yhtenäinen tumma teema, kohtuullinen hierarkia, tekstin katkaisu hoidettu, badge on siisti. Se ei nolaa ketään — mutta siinä ei ole mitään omaa. Se näyttää täsmälleen siltä miltä jokainen AI:lla generoitu Tailwind-aloitussivu näyttää: harmaa kortti harmaan päällä, ei ikoneita, ei logoa, ei typografista valintaa, ei brändiväriä. "Työmaita: 3" -laskurikortti on klassinen AI-slop-signaali: tilastokortti jota kukaan ei tarvitse, koska sama tieto näkyy listasta suoraan sen alla.

Kirjautumissivu on heikoin lenkki ja selvimmin slop: sini-punainen "Asentaja MVP" -logoteksti näyttää harjoitustyöltä, ja valkoinen vaalea kortti tummalla taustalla on eri maailmasta kuin sovelluksen tumma sisäosa. Sovelluksella on kaksi identiteettiä: kirjautuessa "Asentaja MVP", sisällä "ProFloor". Kumpi brändi on?

Kenttäkäytön näkökulmasta iso puute: tumma teema kiiltävällä näytöllä kirkkaassa työmaavalossa on huono valinta, ja osa kosketuskohteista (uloskirjautuminen, `text-xs`) on aivan liian pieniä hanskakäteen.

**Visuaalinen arvosana: etusivu 6/10 (siisti mutta kasvoton), kirjautuminen 3/10.**

## 4. Kriittinen kokonaisarvosana asentajaosuudesta: **3 / 10**

Perustelu: pohjatyö on tehty oikein (autentikointi, roolimalli, siisti komponenttirakenne, TypeScript, järkevä tietomallin alku) — se ansaitsee kolmosen. Mutta arvosanaa ei voi antaa enempää, koska asentaja ei voi sovelluksella *tehdä yhtään mitään*: ainoa näkymä on lukulista, jonka kortit eivät johda minnekään, backend on alhaalla, ja monivuokraajasuodatus puuttuu. MVP:n mitta on "voiko käyttäjä suorittaa ydintehtävänsä" — vastaus on tällä hetkellä ei.

## 5. Lista: mitä pitää tehdä, jotta päästään 10:een

### A. Perusta kuntoon (ilman näitä mikään muu ei merkitse)

1. **Herätä Supabase-projekti** ja estä sen pausautuminen (aktiivisuus tai maksullinen taso); varmista `.env`-käytännöt.
2. **Varmista RLS-politiikat ja lisää organisaatio- ja asentajakohtainen suodatus** työmaihin (assignments-taulu: kuka on kohdennettu millekin työmaalle).
3. **Siivous:** konsoli-lokit pois, testitunnukset pois kirjautumissivulta, `lang="fi"`, oikea otsikko, README, Supabasen generoidut TypeScript-tyypit käyttöön, reititys (react-router) ehtopinon tilalle.

### B. Asentajan ydintoiminnot (tämä on se varsinainen sovellus)

4. **Työmaasivu:** kortin klikkaus avaa työmaan — tiedot, yhteyshenkilö + soita-nappi, navigointilinkki karttaan, työohjeet ja liitteet (pohjakuvat, materiaalilista).
5. **Tunti-/suoritekirjaus:** aloita–lopeta tai käsinsyöttö; mattoasentajalle olennaisena myös suoriteperusteinen kirjaus (m² asennettu, jalkalistametrit, materiaali). Hukkaprosentti tulee profiilista automaattisesti — kenttä on jo tietomallissa.
6. **Materiaalikirjaukset:** mitä materiaalia kului ja kuinka paljon — kytkeytyy varasto-rooliin joka on jo roolimallissa.
7. **Valokuvat ja huomiot:** ennen/jälkeen-kuvat, poikkeamailmoitus (alusta kostea, kynnysdetalji puuttuu, mittavirhe) joka menee suoraan työnjohdolle.
8. **Valmiiksi-kuittaus** huone-/alue-tasolla → syntyy reaaliaikainen valmiusaste.
9. **Oma palkkajakso -näkymä:** kertyneet tunnit ja suoritteet ennen katkopäivää — `pay_period_cutoff` ja `hourly_rate` ovat jo tietomallissa, näkymä puuttuu.

### C. Kenttäkäytettävyys

10. **Offline-first PWA:** kirjaukset paikalliseen jonoon, synkronointi kun verkko palaa; sovellus asennettavaksi kotinäytölle.
11. **Hanskakäyttö:** isot kosketusalueet (min. 48 px), suuret fontit, mahdollisimman vähän näppäilyä — valinnat nappuloilla, ei tekstikentillä.
12. **Vaalea/tumma teema** olosuhteiden mukaan; suomenkieliset virheilmoitukset, uudelleenyritys ja skeleton-lataustilat.

### D. Visuaalinen identiteetti

13. **Yksi brändi** (ProFloor vai mikä?): logo, värijärjestelmä, typografia; lucide-ikonit käyttöön; kirjautumissivu samaan maailmaan sovelluksen kanssa; turha laskurikortti pois tai tilalle oikeasti hyödyllinen "tänään"-kooste.

### E. Laatu ja luotettavuus

14. **Testit kriittisille poluille, virheseuranta (esim. Sentry), push-ilmoitukset** työnjohdon muutoksista (uusi keikka, aikataulumuutos).

## 6. Loppuraportti ja pohjustus aivoriiheen

Nykyinen asentajaosuus on rehellisesti sanottuna vasta kirjautumisdemo, jossa on hyvä perustus mutta ei vielä tuotetta. Se ei ole AI-sloppia rumuudessaan — se on sloppia *sisällöttömyydessään*: siisti kuori, jonka alla ei ole yhtään asentajan työtä helpottavaa toimintoa.

Vahvin oivallus tietomallissa on jo olemassa, ja siihen aivoriihi kannattaa rakentaa: **jokainen asentajan kentällä tekemä kirjaus on ilmaista dataa työnjohdolle.** Kun asentaja kuittaa neliöt, kuvaa poikkeaman ja merkitsee huoneen valmiiksi, työnjohtaja saa ilman yhtäkään puhelua: reaaliaikaisen valmiusasteen työmaittain, tuntien ja suoritteiden kertymän palkanlaskentaan ja laskutukseen, materiaalimenekin ja hukan seurannan, valokuvadokumentaation reklamaatioiden varalle sekä poikkeamat heti eikä viikkopalaverissa. Asentajan sovellus ja työnjohdon työpöytä ovat saman datan kaksi päätä — kun asentajan kirjaaminen tehdään niin helpoksi että se oikeasti tapahtuu (isot napit, pari painallusta, toimii ilman verkkoa), työnjohdon näkymä syntyy melkein itsestään.

Aivoriiheen ehdotan kolmea kysymystä: (1) mikä on se **yksi** kirjaus, jonka jokainen asentaja tekee joka päivä ilman poikkeusta — siitä MVP:n ydin; (2) tunti- vai suoriteperusteinen palkkaus vai molemmat — tämä ratkaisee kirjausmallin; (3) mitä työnjohtaja tänään kysyy puhelimessa useimmin — se ominaisuus rakennetaan ensin.

---

*Liitteet: kuvakaappaukset kirjautumissivusta ja asentajan etusivusta (ajettu mock-datalla, koska tuotantokanta on pausella).*
