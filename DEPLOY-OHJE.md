# Uuden version julkaisu Verceliin (v0.4)

Sovelluksen koodi on nyt niin laaja, ettei se mahdu enää kerralla Claude-session
deploy-työkalun läpi. Julkaisu onnistuu koneeltasi kahdella komennolla:

## Kertajulkaisu (2 min)

Avaa Terminaali kansiossa `asentaja-mvp` ja aja:

    npm install
    npx vercel --prod

- Ensimmäisellä kerralla `vercel` pyytää kirjautumaan (sama tunnus jolla
  asentaja-mvp.vercel.app on jo luotu) ja kysyy liitetäänkö olemassa olevaan
  projektiin → valitse **Link to existing project** → `asentaja-mvp`.
- Sen jälkeen julkaisu on aina pelkkä `npx vercel --prod`.

## Suositus jatkoon: GitHub-kytkentä (automaattijulkaisu)

1. Luo GitHubiin repo (esim. `asentaja-mvp`) ja pushaa tämä kansio sinne.
2. Vercelin dashboardissa: Project → Settings → Git → Connect → valitse repo.
3. Jatkossa jokainen `git push` julkaisee automaattisesti — ja Claude voi
   valmistella muutokset suoraan tähän kansioon, sinä vain pushaat.

## Mitä v0.4 sisältää (protosta varastetut ominaisuudet)

- Etusivu: viimeiset 7 pv (kirjaukset, työpäivät, ansaittu €), kaikki yhteensä,
  työmaakohtaiset summat, Raportti-pikanappi
- Urakkakirjaus: monikoodipaketit (esim. hionta+imurointi+laatta yhdellä
  neliösyötöllä, 110-hitsauskoodit automaattisesti 50 %), TES-kategoriaselaus
- Vapaa urakka (oma kuvaus, määrä, yksikkö, á-hinta)
- Tuntikirjaus: Kuitattava/Oma-jako, 12 tuntilajia, pikatuntinapit, €-esikatselu
- Materiaalisaldon automaattivähennys kirjauksesta (+hukka-% profiilista)
- Raportti-sivu: 7 pv / 30 pv / palkkakausi / kaikki → PDF-raportti ja
  tililappu-Excel (Taul-välilehdet työmaittain + Tuntilappu)
