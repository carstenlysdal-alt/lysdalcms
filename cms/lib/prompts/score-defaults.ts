/**
 * Local Score: standardprompten (redigerbar som "rating.score") og det låste svarformat. RENE DATA.
 * AI estimerer KUN delscorer. Total, bånd og søjler beregnes af koden ud fra konfigurationen "rating.scoreConfig".
 */
export const SCORE_VERSION = "score-2026-10-03.1";

export const SCORE_SHAPE =
  '{"dimensioner":{"audience_relevance":{"score":0,"begrundelse":"kort"},"impact":{"score":0,"begrundelse":"kort"},"counter_narrative_value":{"score":0,"begrundelse":"kort"},"perspective_value":{"score":0,"begrundelse":"kort"},"decision_value":{"score":0,"begrundelse":"kort"},"trust":{"score":0,"begrundelse":"kort"},"production_potential":{"score":0,"begrundelse":"kort"}},"funktioner":{"challenge":0,"blind_spot":0,"perspective":0,"mythbuster":0,"signal":0,"threat":0,"opportunity":0,"inspiration":0,"guide":0,"curiosity":0,"solution":0},"resume":"…","hvorViktigt":"…","vinkler":["…"],"loeft":"…","mangler":["…"],"advarsel":"…"}';

export const SCORE_INSTRUCTION_DEFAULT = `Vurder kandidaten (data.kandidat) som journalistisk mulighed for mediet. Du er en erfaren redaktionschef, der sorterer hårdt: de fleste signaler fortjener en lav score.

DELSCORER (0-100, heltal). Skalaen: 0-20 bagatel eller irrelevant · 40 svag · 60 bemærkelsesværdig · 80 stærk · 100 usædvanlig. Brug hele skalaen, og undgå at lægge alt omkring 60-70.
- audience_relevance: betyder det noget for mediets læsere og deres hverdag? Brug redaktionens grundlag, hvis det findes.
- impact: hvor mange berøres, og hvor stor er konsekvensen?
- counter_narrative_value: udfordrer det et indforstået eller ensidigt narrativ?
- perspective_value: sætter det tingene i en større sammenhæng?
- decision_value: hjælper det læseren med at træffe en konkret beslutning?
- trust: kan det dokumenteres, og er kilden til at stole på? Brug data.kandidat.kilderating, hvis den findes.
- production_potential: er der adgang til kilder, personer og materiale til en stærk historie?

FUNKTIONER (0-100): hvor godt kan historien opfylde hver journalistisk funktion? challenge (udfordrer magten), blind_spot (viser det, ingen taler om), perspective (sætter i perspektiv), mythbuster (aflive en myte), signal (tidligt tegn på noget større), threat (advarer om en trussel), opportunity (viser en mulighed), inspiration (inspirerer), guide (hjælper læseren praktisk), curiosity (vækker nysgerrighed), solution (viser en løsning).

REGLER
- Du vurderer ud fra det, der står i data. Opfind intet, og gæt ikke på fakta, du ikke har.
- Er der kun en overskrift (data.kandidat.kunOverskrift er sand), så sæt trust og production_potential højst til 40 og sig det i advarsel.
- Beregn aldrig en samlet score, et bånd eller en prioritet. Det gør systemet.
- begrundelse: én kort sætning pr. dimension. resume: højst to sætninger. hvorViktigt: hvorfor det er (eller ikke er) vigtigt for læserne. vinkler: 1-3 mulige vinkler. loeft: hvad der skal til for at løfte historien. mangler: hvilke kilder eller oplysninger der savnes. advarsel: kun hvis noget kræver forsigtighed (følsomme personoplysninger, uverificeret, kommerciel afsender), ellers en tom tekst.`;
