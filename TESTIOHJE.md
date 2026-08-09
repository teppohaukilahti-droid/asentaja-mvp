# TESTIOHJE — huomisen testisessio

## 1. Julkaisu (ensimmäisenä, ~1 min)

Uusia npm-paketteja EI tullut — `npm install` ei tarvita.

```
cd ~/Downloads/asentaja-mvp
npx vercel --prod --archive=tgz
```

Kun näkyy "✓ Ready", avaa https://asentaja-mvp.vercel.app puhelimella ja koneella.

## 2. Testitunnukset

| Rooli | Sähköposti | Salasana |
|---|---|---|
| Asentaja | asentaja@test.fi | Testi123! |
| Työnjohtaja | tyonjohtaja@test.fi | Testi123! |
| Varasto | varasto@test.fi | Testi123! |

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

## 4. UUSI: Kirjauksen muokkaus

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
