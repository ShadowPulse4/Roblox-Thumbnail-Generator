# Nugget Studio AI

Een webapp waarmee je Roblox-thumbnails maakt vanuit een tekstprompt. Je beschrijft wat je wilt, kiest een stijl en beeldverhouding, en de app laat een beeldmodel de afbeelding maken. Daarna kun je hem downloaden, bewerken, variaties maken, er foutloze tekst op zetten (“NEW UPDATE!”) en later terugvinden in je eigen galerij.

- Interface in het Nederlands, donker thema, werkt op desktop, tablet en telefoon.
- Draait standaard **lokaal op je eigen computer**, zonder account.
- Met één instelling kun je **vrienden laten inloggen**, elk met een eigen daglimiet.

> De naam en het logo zijn een werktitel. Pas ze aan in `lib/brand.ts` (naam, tagline, bestandsnaam van downloads) en het logo-SVG in `components/layout/app-shell.tsx`.

---

## Welke diensten worden gebruikt

| Taak | Dienst | Verplicht? | Kost geld? |
| --- | --- | --- | --- |
| Afbeeldingen maken en bewerken | **OpenAI GPT Image** (standaard `gpt-image-2`) via de officiële `openai` SDK | Ja, om te genereren | Ja, per afbeelding |
| Prompt verbeteren | **Claude** via de officiële Anthropic API (`@anthropic-ai/sdk`, standaard `claude-haiku-5-5`) | Nee | Ja, per gebruik (meestal fracties van een cent) |
| Tekst op de thumbnail | Lokaal met `sharp` en de meegeleverde lettertypes | – | Nee |
| Database en opslag | Lokaal: SQLite-bestand + map met PNG's in `data/` | – | Nee |

**Waarom niet Claude voor de afbeeldingen?** Claude-modellen geven alleen tekst terug; ze maken geen afbeeldingen. Claude doet hier wat het goed kan: je korte idee omschrijven tot een gedetailleerde beeldbeschrijving.

**Waarom OpenAI GPT Image?** Het kan willekeurige formaten maken (dus echt 1920×1080), heeft echte kwaliteitsstanden, ondersteunt het bewerken van een bestaande afbeelding, en is via één API-sleutel te gebruiken. De code is zo opgezet dat je later een andere dienst kunt toevoegen (zie *Architectuur*).

### Je Claude-abonnement en de API zijn twee verschillende dingen

Een Claude Pro- of Max-abonnement (claude.ai) geeft **geen** API-tegoed. Voor de API maak je een account in de Claude Console (platform.claude.com), laad je apart tegoed op en betaal je per gebruikte token. Hetzelfde geldt voor OpenAI: een ChatGPT-abonnement is iets anders dan API-tegoed op platform.openai.com.

---

## Snel starten

Je hebt **Node.js 22 of nieuwer** nodig (`node -v` om te controleren).

```bash
git clone https://github.com/ShadowPulse4/Roblox-Thumbnail-Generator.git
cd Roblox-Thumbnail-Generator
npm install
cp .env.example .env.local      # Windows: copy .env.example .env.local
npm run dev
```

Open daarna http://localhost:3000.

Zonder sleutels werkt de hele interface al: je ziet een duidelijke melding dat er nog geen beeldmodel is ingesteld. Er worden **nooit** nep-afbeeldingen getoond.

### API-sleutels toevoegen

Open `.env.local` in een teksteditor en vul in:

```bash
OPENAI_API_KEY=sk-...          # verplicht voor afbeeldingen
ANTHROPIC_API_KEY=sk-ant-...   # optioneel, voor "Prompt verbeteren"
```

Herstart daarna `npm run dev`. Onder **Instellingen** in de app zie je of beide diensten gekoppeld zijn.

**OpenAI-sleutel**
1. Ga naar https://platform.openai.com/api-keys en maak een sleutel aan.
2. Laad tegoed op onder *Billing*. Stel daar ook een maandlimiet in.
3. Krijg je een melding dat toegang geweigerd is? Voor GPT Image-modellen moet je organisatie soms eerst geverifieerd worden (*Settings → Organization → Verify*).

**Anthropic-sleutel (optioneel)**
1. Ga naar https://platform.claude.com, maak een account en een API-sleutel aan.
2. Laad tegoed op onder *Billing*.

**Bewaar sleutels alleen in `.env.local`** (of in de geheimenbeheerder van je hostingpartij). Dat bestand staat in `.gitignore` en komt dus nooit op GitHub. Plak een sleutel nooit in de broncode. Sleutels worden alleen op de server gebruikt; geen enkele variabele begint met `NEXT_PUBLIC_`.

---

## Wat het kost en hoe de app je beschermt

De app registreert elk verzoek (welke dienst, welk model, hoeveel tokens) en **schat** de kosten met de prijstabel in `lib/usage/pricing.ts`. OpenAI en Anthropic geven per verzoek geen gefactureerd bedrag terug, dus elke prijs in de app is gelabeld als *geschat*. Je echte rekening staat in je OpenAI- en Anthropic-dashboard. Controleer de prijstabel af en toe met de officiële prijspagina's en pas hem aan als dat nodig is; voor modellen die er niet in staan toont de app *onbekend* in plaats van te gokken.

Ingebouwde remmen (allemaal op de server gecontroleerd, aan te passen in `.env.local`):

| Instelling | Standaard | Wat het doet |
| --- | --- | --- |
| `DAILY_SPEND_LIMIT_USD` | 5 | Stopt alle AI-verzoeken als de geschatte uitgaven van vandaag dit bedrag bereiken |
| `MONTHLY_SPEND_LIMIT_USD` | 30 | Hetzelfde per maand |
| `DAILY_IMAGE_LIMIT_PER_USER` | 20 | Afbeeldingen per lid per dag (per account aan te passen) |
| `MAX_IMAGES_PER_REQUEST` | 4 | Maximaal aantal afbeeldingen per klik |
| `RATE_LIMIT_PER_MINUTE` | 6 | Verzoeken per gebruiker per minuut |

Daarnaast: maximaal 2 generaties tegelijk per gebruiker, en een installatie **zonder login weigert betaalde verzoeken in productie** (zodat een publiek bereikbare site nooit jouw tegoed kan opmaken).

Stel ook altijd een bestedingslimiet in bij OpenAI en Anthropic zelf; dat is de harde grens.

---

## Vrienden laten meedoen

1. Zet in `.env.local`:
   ```bash
   AUTH_MODE=local
   ```
2. Herstart de app. Je komt op een pagina om het **eerste beheerdersaccount** aan te maken (dat ben jij).
3. Ga naar **Instellingen → Accounts → Vriend toevoegen**, kies een gebruikersnaam en wachtwoord en geef die persoonlijk door. Per vriend kun je een daglimiet instellen.

Iedereen ziet alleen zijn eigen creaties en favorieten. Jij als beheerder ziet onder *Gebruik en kosten* het totaal van iedereen, want jij betaalt de rekening.

Je vrienden moeten de app wel kunnen bereiken. Opties:

- **Thuisnetwerk**: draai de app op je eigen pc (zie *Productie*), zoek het lokale IP-adres op en laat vrienden in hetzelfde netwerk naar `http://192.168.x.x:3000` gaan. Zet dan ook `COOKIE_SECURE=false`, anders werkt inloggen niet over gewoon http.
- **Online**: een server met een vaste schijf, zoals een kleine VPS, Railway of Fly.io met een *volume* voor de `data`-map. Gebruik dan HTTPS en laat `COOKIE_SECURE=true` staan.

> **Niet geschikt voor Vercel/Netlify in deze vorm.** Die platforms hebben geen blijvende schijf, dus de database en afbeeldingen zouden verdwijnen. Daarvoor is de stap naar Supabase bedoeld (zie hieronder).

---

## Productie

```bash
npm run build
npm start          # draait op poort 3000; ander poortnummer: npm start -- -p 8080
```

Maak regelmatig een back-up van de map uit `DATA_DIR` (standaard `data/`): daarin staan `app.db` en alle afbeeldingen.

---

## Wat de app kan

- **Genereren**: prompt, stijl (9 stijlen), beeldverhouding (16:9 = 1920×1080, 1:1, 4:3, 9:16), kwaliteit en 1/2/4 afbeeldingen. Ctrl/⌘ + Enter om te starten. De prompt blijft staan als er iets misgaat.
- **Prompt verbeteren** met Claude. Het resultaat is gewoon tekst die je nog aanpast; met *Origineel terug* ga je terug naar je eigen versie.
- **Zoeker**: het voorbeeldvlak heeft altijd de gekozen verhouding, en je ziet je overlay-tekst al staan voordat je genereert.
- **Leesbaarheidscheck**: je resultaat op 168 px breed, het formaat in lijsten en zijbalken.
- **Tekst op de thumbnail**: lokaal over de afbeelding gezet met de echte lettertypes (Luckiest Guy of Anton), in drie opmaken: een **3D-titel** met goudverloop, dikke rand en gloed (zoals “EPIC BOSSES”), tekst **met rand** (zoals “YOU”) en een **label** op een donker vlak (zoals “+1,000,000 STRENGTH”). Tot drie regels, met optioneel een rode **pijl** naar je onderwerp. Grootte, positie, kleuren en kanteling zijn instelbaar. De browser-preview en het resultaat gebruiken dezelfde code en hetzelfde lettertype en zijn dus gelijk. Je tekst wordt letterlijk overgenomen.
- **Bewerken**: beschrijf een wijziging (“maak de achtergrond paars”); het beeldmodel past de bestaande afbeelding aan. Het origineel blijft bewaard.
- **Variaties**: nieuwe versies met hetzelfde onderwerp en dezelfde stijl.
- **Mijn creaties en Favorieten**: zoeken, filteren op stijl, sorteren, downloaden, verwijderen (met bevestiging), prompt hergebruiken.
- **Stijlen ontdekken**: twaalf startpunten (baasgevechten, steal-games, pets, simulators, tycoons, game-iconen, anime, Halloween, kerst, updates). Waar het past staat er een van je eigen referentiethumbnails bij (gelabeld als *Referentiebeeld*); de rest heeft een gelabelde illustratie.
- **Gebruik en kosten**: vandaag, deze maand, per dag, en de laatste verzoeken.

### Stijlen, afgestemd op je referenties

De stijlbeschrijvingen in `lib/ai/styles.ts` zijn afgeleid van je referentiethumbnails (staan in `public/examples/`). Wat die gemeen hebben, gaat als vaste “huisstijl” mee bij de Roblox-stijlen: glanzende 3D Roblox-avatars, overdreven cartoongezichten, een witte sticker-rand om de hoofdpersonen, felle kleuren met sterk randlicht, en stripeffecten zoals schrikstreepjes, zweetdruppels, glinsteringen en snelheidslijnen. *Felle simulator* en *Tycoon* gebruiken juist de strakkere, vlakke cartoonlook van je simulator- en tycoon-voorbeelden. De nieuwe stijl *Stelen en wegrennen* is gemaakt voor steal-games. Bevalt een stijl niet na je eerste echte generaties, pas dan de tekst in `styles.ts` aan.

### Kwaliteitsstanden

De app toont alleen standen die het ingestelde model echt ondersteunt, en laat zien welke waarde er naar OpenAI gaat.

| Model | Standaard | Hoog | Ultra |
| --- | --- | --- | --- |
| `gpt-image-2` | `medium` | `high` | niet beschikbaar |
| `gpt-image-2.5-flare` / `-sunburst` | `medium` | `high` | `xhigh` |
| oudere modellen (`gpt-image-1.5` e.d.) | `medium` | `high` | niet beschikbaar |

Oudere modellen kunnen alleen 1024×1024, 1536×1024 en 1024×1536 maken; de app maakt dan het dichtstbijzijnde formaat en snijdt het midden bij tot de gekozen verhouding. De echte uitvoermaat staat altijd bij het resultaat.

---

## Architectuur

```
app/
  (app)/                 pagina's met zijbalk: genereren, creaties, favorieten, stijlen, gebruik, instellingen
  login/, setup/         inloggen en eerste beheerder (alleen bij AUTH_MODE=local)
  api/
    generate/            nieuwe generatie starten (202 + id)
    generations/         galerij-lijst en status per generatie (wordt elke 2 s opgevraagd)
    edit/, variations/   bewerken en variaties (bron = bestaande afbeelding)
    overlay/             tekst lokaal op een afbeelding zetten
    enhance-prompt/      Claude-promptverbetering
    images/[id]/         afbeelding serveren (alleen aan de eigenaar), favoriet, verwijderen
    usage/, status/      gebruik en configuratiestatus
    auth/, users/, account/
components/              ui/ (basiscomponenten), layout/, generator/, gallery/, settings/, usage/
lib/
  ai/
    providers/           ImageGenerationProvider-implementaties + selectie via IMAGE_PROVIDER
    models.ts            formaten en kwaliteitsstanden per model
    prompt-builder.ts    stijl-, formaat- en leesbaarheidsinstructies rond jouw prompt
    enhancer.ts          Claude via tool use (gestructureerd antwoord)
    errors.ts            vertaalt providerfouten naar veilige Nederlandse meldingen
  jobs/generation.ts     voert generaties uit na het antwoord (next/server `after`)
  database/              SQLite-schema en alle queries (altijd gefilterd op gebruiker)
  storage/local.ts       bestandsopslag met padcontrole
  overlay/               tekst-layout (gedeeld door browser en server) en render met sharp
  usage/                 prijstabel, registratie, limieten
  auth/                  wachtwoord-hash (scrypt) en sessies (httpOnly-cookie, alleen hash in de database)
types/                   gedeelde typen voor frontend en backend
supabase/migrations/     Postgres-schema met Row Level Security voor een latere overstap
tests/                   Vitest
```

**Een andere beeld-dienst toevoegen**: maak in `lib/ai/providers/` een bestand dat `ImageGenerationProvider` uit `types/provider.ts` implementeert (`generateImage`, en waar mogelijk `editImage`, `generateVariations`, `getGenerationStatus` voor diensten die met een taak-id werken) en voeg het toe aan de `switch` in `lib/ai/providers/index.ts`. De rest van de app leest de mogelijkheden via `getSupportedCapabilities()` en past de interface daarop aan.

**Overstap naar Supabase** (voor hosting zonder vaste schijf): `supabase/migrations/0001_init.sql` bevat hetzelfde schema voor Postgres, met RLS-regels en een privé opslagbucket. De app gebruikt het nog niet; voor de overstap is een Supabase-variant van `lib/database/repo.ts` en `lib/storage/local.ts` nodig, plus Supabase Auth in `lib/auth/session.ts`.

---

## Testen en controles

```bash
npm run check      # typecheck + lint + tests
npm test           # alleen de tests
```

De tests (Vitest) dekken o.a. promptvalidatie, providerkeuze, foutafhandeling van OpenAI en Claude (met nep-clients, er worden geen betaalde verzoeken gedaan), toegangscontrole tussen gebruikers, daglimieten en uitgavenlimieten, galerij zoeken/filteren, de volledige generatie-flow via de echte API-routes, downloadbestandsnamen, tekst-overlays en het ontbreken van sleutels.

Wat **niet** automatisch getest is: een echte betaalde generatie bij OpenAI. Na het instellen van je sleutel is de eerste echte thumbnail dus ook de eerste echte test.

---

## Problemen oplossen

| Melding of probleem | Oplossing |
| --- | --- |
| “Nog geen beeldmodel ingesteld” | `OPENAI_API_KEY` ontbreekt in `.env.local`, of je hebt de app niet herstart. |
| “De API-sleutel voor OpenAI is ongeldig” | Sleutel verkeerd gekopieerd of ingetrokken. Maak een nieuwe aan. |
| “OpenAI weigert toegang tot dit model” | Verifieer je organisatie bij OpenAI, of kies een ander `IMAGE_MODEL`. |
| “Je tegoed bij OpenAI is op” | Laad tegoed op of verhoog je limiet in het OpenAI-dashboard. |
| “Kan OpenAI niet bereiken” | Geen internet, of een firewall/proxy blokkeert api.openai.com. |
| “uitgavenlimiet (geschat) is bereikt” | Verhoog `DAILY_SPEND_LIMIT_USD` / `MONTHLY_SPEND_LIMIT_USD` of wacht tot morgen. |
| “inhoudsbeleid” | Het beeldmodel heeft de prompt geweigerd. Formuleer hem anders. |
| Tekst met emoji of bijzondere tekens wordt geweigerd | De meegeleverde lettertypes tekenen alleen Latijnse tekens. |
| Inloggen werkt niet via `http://192.168…` | Zet `COOKIE_SECURE=false` en herstart. |
| `npm install` faalt bij `better-sqlite3` | Gebruik Node.js 22 of nieuwer. |
| De pagina blijft zichzelf herladen tijdens `npm run dev` | Stop de server, verwijder de map `.next` en start opnieuw. |
| Een generatie blijft “bezig” na een herstart | Wordt na de tijdslimiet automatisch als onderbroken gemarkeerd; er zijn dan geen kosten geregistreerd. |

---

## Licenties

De lettertypes in `public/fonts/` zijn Luckiest Guy (Apache 2.0) en Anton (SIL OFL 1.1); zie `public/fonts/LICENSES.txt`. Controleer de gebruiksvoorwaarden van OpenAI voor wat je met gegenereerde afbeeldingen mag doen, en de Roblox-richtlijnen voor thumbnails voordat je ze uploadt.
