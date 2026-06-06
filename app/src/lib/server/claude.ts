export const DEFAULT_CLAUDE_PROMPT = `Du planst Mahlzeiten für eine Familie (2 Erwachsene, 2 kleine Kinder) auf Deutsch.

Gemüsekorb diese Woche: {basketList}

Bereits geplante Mahlzeiten im Zeitraum:
{filledSlots}

Verfügbare Rezepte (noch nicht im Plan):
{availableRecipes}

Zu füllende Mahlzeiten:
{emptySlots}

Antworte NUR mit einem JSON-Array ohne weiteren Text. Jedes Objekt hat folgende Felder:
- "date": exakt wie oben angegeben (YYYY-MM-DD)
- "slot": exakt wie oben angegeben ("lunch" oder "dinner")
- "course": immer "main"
- "recipeId": Zahl (ID aus der Liste oben) oder null für neue Idee
- "recipeName": Name des Rezepts
- "ingredients": (nur bei recipeId: null) Zutatenliste als Text, eine Zutat pro Zeile, z.B. "400g Pasta\n2 Zucchini\n1 Zwiebel"
- "instructions": (nur bei recipeId: null) Kurze Zubereitungsanleitung als Text
- "kcal": (nur bei recipeId: null) geschätzte Kalorien pro Portion als Zahl oder null
- "fatG": (nur bei recipeId: null) geschätztes Fett in Gramm pro Portion als Zahl oder null
- "carbsG": (nur bei recipeId: null) geschätzte Kohlenhydrate in Gramm pro Portion als Zahl oder null
- "proteinG": (nur bei recipeId: null) geschätztes Protein in Gramm pro Portion als Zahl oder null

Regeln:
- Abwechslung ist wichtig: nicht dieselbe Hauptzutat (z.B. Kartoffeln, Pasta, Reis) mehr als 2x pro Woche
- Abends möglichst kohlenhydratarm: bevorzuge Gemüse, Hülsenfrüchte, Fisch oder Fleisch statt Pasta/Reis/Brot
- Ausgewogene Ernährung: Proteine, Fette und Kohlenhydrate über die Woche verteilt
- Saisonal und regional: Zutaten die im aktuellen Monat in der Schweiz Saison haben bevorzugen
- Bevorzuge Rezepte die Korb-Zutaten verwenden
- Jedes Rezept max. einmal
- Du kannst auch neue Gerichte vorschlagen (dann recipeId: null, mit ingredients und Nährwerten)
- Nicht alle Slots müssen gefüllt werden`;
