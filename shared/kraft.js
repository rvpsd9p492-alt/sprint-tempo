/* Kräftigung: Übungsbibliothek, Strichfiguren-Skizzen und Belastungsempfehlung. */
(function () {
  "use strict";

  /* ---------- Bereiche, Ausrüstung, Steuerung ---------- */
  const REGIONS = { beine: "Beine", huefte: "Hüfte & Gesäß", sprung: "Sprungkraft", rumpf: "Rumpf", ober: "Oberkörper", ganz: "Ganzkörper" };
  const EQUIP = { ohne: "ohne Gerät", kh: "Kurzhanteln", lh: "Langhantel", kb: "Kettlebell", band: "Miniband / Theraband", box: "Box / Bank",
    stange: "Klimmzugstange", ball: "Medizinball", partner: "Partner" };
  const GOALS = { ka: "Kraftausdauer", hyp: "Muskelaufbau", max: "Maximalkraft", sk: "Schnellkraft" };
  const LEVELS = { ein: "Einsteiger", fort: "Fortgeschritten", leist: "Leistungssport" };
  const PHASES = { allg: "Allgemeine Vorbereitung", spez: "Spezielle Vorbereitung", wk: "Wettkampfphase", reg: "Übergang / Regeneration" };
  const DEFAULTS = { goal: "hyp", level: "fort", phase: "allg" };

  /* ---------- Übungen ----------
     kind: load = mit Zusatzlast, bw = Körpergewicht, iso = Halten (Sekunden), plyo = Sprünge, power = explosiv mit Gerät
     side: je Seite; cap: [von, bis] Obergrenze der Wdh./Sekunden (z. B. Nordic Curls); poses: [Start, Ende] als Gelenkwinkel (siehe Skizze unten) */
  const EX = [
    { id: "kniebeuge", name: "Kniebeuge", region: "beine", equip: ["lh"], level: 2, kind: "load",
      muscles: "Oberschenkel vorn, Gesäß, Rumpf",
      why: "Grundübung für Beinkraft – Basis für Startbeschleunigung und Sprungkraft.",
      steps: ["Hantel auf dem oberen Rücken, Füße etwa schulterbreit, Fußspitzen leicht nach außen.", "Hüfte nach hinten-unten setzen, Knie folgen den Fußspitzen.", "Bis die Oberschenkel mindestens waagerecht sind, Rücken gerade.", "Kraftvoll über die ganze Fußsohle zurück in den Stand drücken."],
      cues: ["Fersen bleiben am Boden", "Knie nicht nach innen fallen lassen", "Brust aufrecht, Blick nach vorn"],
      easier: "Ohne Hantel oder Kniebeuge zur Box", harder: "Frontkniebeuge, mehr Gewicht",
      poses: [{ t: 4, l1: [2, 0], l2: [6, 4], r1: [-25, 165], r2: [-20, 165] }, { t: 42, l1: [82, -28], l2: [86, -24], r1: [5, 175], r2: [10, 175] }],
      props: [{ t: "plate", at: "s", dx: -3, dy: 2 }] },
    { id: "bulgarisch", name: "Bulgarische Kniebeuge", region: "beine", equip: ["kh", "box"], level: 2, kind: "load", side: true,
      muscles: "Oberschenkel vorn, Gesäß, Hüftbeuger der hinteren Seite",
      why: "Einbeinige Kraft und Stabilität – wie im Sprint, wo immer ein Bein arbeitet.",
      steps: ["Hinterer Fuß mit dem Spann auf der Bank, vorderer Fuß gut einen Schritt davor.", "Senkrecht nach unten absenken, bis das hintere Knie fast den Boden berührt.", "Über die vordere Ferse zurück nach oben drücken."],
      cues: ["Vorderes Knie bleibt über dem Fuß", "Oberkörper leicht nach vorn geneigt, Rücken gerade", "Becken bleibt gerade"],
      easier: "Ohne Hanteln, mit Hand an der Wand", harder: "Schwerere Hanteln, langsames Absenken (3 s)",
      poses: [{ t: 6, l1: [6, -4], l2: [-28, -112], r1: [0, 0], r2: [2, 2] }, { t: 18, l1: [78, -18], l2: [4, -92], r1: [8, 6], r2: [10, 8] }],
      props: [{ t: "db", at: "h1" }, { t: "boxUnder", at: "a2", w: 18, dx: -6 }], ax: "a1", x: 72 },
    { id: "ausfall", name: "Ausfallschritte", region: "beine", equip: ["ohne", "kh"], level: 1, kind: "load", side: true,
      muscles: "Oberschenkel vorn und hinten, Gesäß",
      why: "Kraft in Schrittstellung, verbessert Kniestabilität und Hüftstreckung.",
      steps: ["Aufrecht stehen, mit einem Bein einen großen Schritt nach vorn.", "Absenken, bis beide Knie etwa im rechten Winkel sind.", "Vom vorderen Fuß kraftvoll zurück in den Stand abdrücken."],
      cues: ["Oberkörper aufrecht", "Vorderes Knie nicht über die Fußspitze schieben", "Hinteres Knie kurz vor dem Boden stoppen"],
      easier: "Ausfallschritt am Platz (ohne Zurückdrücken)", harder: "Mit Kurzhanteln oder rückwärts gehend",
      poses: [{ t: 0, l1: [2, 0], l2: [-2, 0], r1: [0, 0], r2: [0, 0] }, { t: 4, l1: [84, -4], l2: [-22, -96], r1: [4, 4], r2: [-4, -4] }],
      ax: "a2", x: 40 },
    { id: "stepup", name: "Step-up", region: "beine", equip: ["box", "kh"], level: 1, kind: "load", side: true,
      muscles: "Oberschenkel vorn, Gesäß, Waden",
      why: "Einbeiniger Kraftstoß nach oben – überträgt sich gut auf Sprint und Sprung.",
      steps: ["Einen Fuß komplett auf die Box (Kniehöhe) stellen.", "Nur mit dem Bein auf der Box hochdrücken, bis es gestreckt ist.", "Das andere Knie dynamisch nach vorn-oben ziehen.", "Kontrolliert wieder absenken."],
      cues: ["Nicht mit dem unteren Bein abstoßen", "Knie bleibt über dem Fuß", "Aufrechter Oberkörper"],
      easier: "Niedrigere Box", harder: "Kurzhanteln, explosiver Knieeinsatz",
      poses: [{ t: 8, l1: [72, -16], l2: [-4, -2], r1: [-30, -20], r2: [35, 70], anchor: ["a2", 92] }, { t: 2, l1: [2, 0], l2: [92, 4], r1: [40, 80], r2: [-35, -20], anchor: ["a1", 70] }],
      props: [{ t: "box", x: 58, y: 70, w: 30 }], ax: "a1", x: 66 },
    { id: "rdl", name: "Rumänisches Kreuzheben", region: "huefte", equip: ["lh", "kh"], level: 2, kind: "load",
      muscles: "Oberschenkel hinten, Gesäß, unterer Rücken",
      why: "Stärkt die hintere Kette – wichtig gegen Zerrungen der Oberschenkelrückseite.",
      steps: ["Hüftbreit stehen, Hantel vor den Oberschenkeln, Knie leicht gebeugt.", "Hüfte weit nach hinten schieben, Hantel gleitet an den Beinen entlang nach unten.", "Bis eine deutliche Dehnung hinten im Oberschenkel spürbar ist.", "Hüfte nach vorn bringen und aufrichten."],
      cues: ["Rücken bleibt gerade – kein Rundrücken", "Knie bleiben fast unverändert leicht gebeugt", "Hantel nah am Körper"],
      easier: "Mit Kurzhanteln oder Stab", harder: "Einbeinig",
      poses: [{ t: 2, l1: [4, -2], l2: [6, 0], r1: [4, 2], r2: [6, 4] }, { t: 80, l1: [16, -6], l2: [18, -4], r1: [0, 0], r2: [2, 2] }],
      props: [{ t: "plate", at: "h1", dy: 2 }] },
    { id: "nordic", name: "Nordic Hamstring Curl", region: "huefte", equip: ["partner"], level: 3, kind: "bw", cap: [3, 6],
      muscles: "Oberschenkel hinten (exzentrisch)",
      why: "Nachweislich wirksam zur Vorbeugung von Zerrungen der Oberschenkelrückseite bei Sprintern.",
      steps: ["Aufrecht knien, ein Partner fixiert die Fersen.", "Körper gestreckt von Knie bis Kopf langsam nach vorn sinken lassen.", "So lange wie möglich bremsen, dann mit den Händen abfangen.", "Mit den Händen leicht abdrücken und zurück in den Kniestand."],
      cues: ["Hüfte bleibt gestreckt – nicht einknicken", "Absenken so langsam wie möglich", "Anfangs wenige, saubere Wiederholungen"],
      easier: "Nur das erste Drittel absenken, Band zur Unterstützung", harder: "Weiter absenken, Hände später einsetzen",
      poses: [{ t: 0, l1: [0, -90], l2: [2, -88], r1: [25, 110], r2: [30, 110] }, { t: 62, l1: [-62, -90], l2: [-60, -88], r1: [75, 85], r2: [80, 85] }],
      props: [{ t: "pad", at: "a1" }], ax: "k1", x: 42 },
    { id: "bruecke1", name: "Hüftbrücke einbeinig", region: "huefte", equip: ["ohne"], level: 1, kind: "bw", side: true,
      muscles: "Gesäß, Oberschenkel hinten",
      why: "Kräftigt die Hüftstreckung einbeinig – der Motor des Sprintschritts.",
      steps: ["Rückenlage, ein Fuß aufgestellt, das andere Bein gestreckt.", "Über die aufgestellte Ferse das Becken anheben, bis Schulter, Hüfte und Knie eine Linie bilden.", "Kurz halten, kontrolliert absenken."],
      cues: ["Becken bleibt waagerecht", "Kein Hohlkreuz – Gesäß anspannen", "Druck über die Ferse"],
      easier: "Beidbeinig", harder: "Fuß auf erhöhter Bank, 3 s halten",
      poses: [{ t: -90, l1: [96, 96], l2: [132, 22], r1: [90, 90], r2: [90, 90] }, { t: -114, l1: [111, 111], l2: [112, 6], r1: [100, 100], r2: [100, 100] }],
      ax: "s", x: 26 },
    { id: "hipthrust", name: "Hip Thrust", region: "huefte", equip: ["lh", "box"], level: 2, kind: "load",
      muscles: "Gesäß, Oberschenkel hinten",
      why: "Maximale Kraft in der Hüftstreckung – eng verbunden mit Sprintgeschwindigkeit.",
      steps: ["Schulterblätter an eine Bank lehnen, Hantel (gepolstert) auf der Hüfte.", "Füße hüftbreit aufstellen.", "Hüfte nach oben drücken, bis der Rumpf waagerecht ist.", "Oben das Gesäß fest anspannen, kontrolliert absenken."],
      cues: ["Kinn leicht zur Brust", "Unterschenkel oben senkrecht", "Kein Überstrecken im unteren Rücken"],
      easier: "Ohne Hantel oder als Hüftbrücke am Boden", harder: "Einbeinig, Pause oben",
      poses: [{ t: -55, l1: [104, 8], l2: [106, 10], r1: [80, 80], r2: [80, 80] }, { t: -92, l1: [90, 0], l2: [92, 2], r1: [80, 80], r2: [80, 80] }],
      props: [{ t: "plate", at: "p", dy: -5 }, { t: "boxUnder", at: "s", w: 16, dx: -2, dy: 3 }], ax: "a1", x: 86 },
    { id: "wade", name: "Wadenheben einbeinig", region: "beine", equip: ["box"], level: 1, kind: "bw", side: true,
      muscles: "Wade, Achillessehne, Fußmuskulatur",
      why: "Kräftige Waden und Achillessehnen für kurze Bodenkontakte und Verletzungsvorbeugung.",
      steps: ["Auf einer Stufe stehen, nur der Ballen eines Fußes steht auf der Kante.", "Ferse langsam unter die Stufenkante absenken.", "Kraftvoll auf die Zehenspitzen drücken, oben kurz halten."],
      cues: ["Knie fast gestreckt", "Über den großen Zeh drücken", "Volle Bewegungsweite, langsam absenken"],
      easier: "Beidbeinig am Boden", harder: "Mit Kurzhantel, 3 s absenken",
      poses: [{ t: 0, l1: [0, 0], l2: [12, -70], r1: [60, 90], r2: [0, 0], f1: 108, anchor: ["t1", 76] }, { t: 0, l1: [0, 0], l2: [12, -70], r1: [60, 90], r2: [0, 0], f1: 42, anchor: ["t1", 76] }],
      props: [{ t: "box", x: 30, y: 76, w: 36 }, { t: "wall", x: 92 }], ax: "t1", x: 64 },
    { id: "copenhagen", name: "Copenhagen Plank", region: "huefte", equip: ["box"], level: 3, kind: "iso", side: true, cap: [15, 30],
      muscles: "Adduktoren (Oberschenkel innen), seitlicher Rumpf",
      why: "Kräftigt die Adduktoren – senkt das Risiko für Leisten- und Adduktorenprobleme.",
      steps: ["Seitstütz auf dem Unterarm, das obere Bein liegt mit dem Knie oder Fuß auf der Bank.", "Becken anheben, bis der Körper eine Linie bildet.", "Das untere Bein frei unter der Bank halten und Position halten."],
      cues: ["Becken nicht nach hinten kippen", "Schulter über dem Ellbogen", "Ruhig weiteratmen"],
      easier: "Knie statt Fuß auf der Bank (kürzerer Hebel)", harder: "Unteres Bein zur Bank führen und wieder weg",
      poses: [{ t: -96, l1: [93, 93], l2: [88, 88], r1: [0, 90], r2: [80, 80] }, { t: -76, l1: [103, 103], l2: [96, 100], r1: [0, 90], r2: [80, 80] }],
      props: [{ t: "boxUnder", at: "a1", ref: 1, w: 14, dx: 2, dy: 2 }], ax: "e1", x: 24, view: "Seitstütz von vorn" },
    { id: "monster", name: "Monster Walk mit Miniband", region: "huefte", equip: ["band"], level: 1, kind: "bw", side: true,
      muscles: "Seitliches Gesäß (Gluteus medius), Hüftstabilisatoren",
      why: "Stabilisiert die Hüfte und hält die Knie beim Laufen in der Spur.",
      steps: ["Miniband um die Knie oder Fußgelenke, leicht in die Hocke gehen.", "Mit Spannung im Band seitlich Schritt für Schritt gehen.", "Gleiche Anzahl Schritte in beide Richtungen."],
      cues: ["Knie nach außen gegen das Band drücken", "Oberkörper ruhig, Becken bleibt auf Höhe", "Füße zeigen nach vorn"],
      easier: "Leichteres Band oberhalb der Knie", harder: "Stärkeres Band an den Fußgelenken, tiefere Hocke",
      poses: [{ t: 0, l1: [24, 6], l2: [-24, -6], r1: [20, 20], r2: [-20, -20], front: true }, { t: 0, l1: [38, 14], l2: [-20, -6], r1: [20, 20], r2: [-20, -20], front: true }],
      props: [{ t: "bandK" }], ax: "a2", x: 46, view: "Frontansicht" },
    { id: "strecksprung", name: "Strecksprung (Squat Jump)", region: "sprung", equip: ["ohne"], level: 1, kind: "plyo",
      muscles: "Beinstrecker, Gesäß, Waden",
      why: "Schnellkraft aus der Hocke – ähnlich dem Startblock-Abdruck.",
      steps: ["Halbe Hocke, Arme hinten.", "Explosiv nach oben springen, Arme schwungvoll nach oben.", "Weich und leise landen, kurz stabilisieren, neu ansetzen."],
      cues: ["Jeder Sprung maximal", "Knie bei der Landung über den Füßen", "Vollständige Pause zwischen den Serien"],
      easier: "Ohne Armeinsatz, geringere Höhe", harder: "Mit Gegenbewegung oder leichter Weste",
      poses: [{ t: 38, l1: [76, -26], l2: [80, -22], r1: [-45, -30], r2: [-40, -25] }, { t: 0, l1: [0, 0], l2: [3, 2], r1: [170, 175], r2: [175, 180], f1: 25, f2: 25, anchor: ["t1", 86] }] },
    { id: "boxjump", name: "Box Jump", region: "sprung", equip: ["box"], level: 2, kind: "plyo",
      muscles: "Beinstrecker, Gesäß, Waden",
      why: "Explosive Hüft- und Kniestreckung bei geringer Landebelastung.",
      steps: ["Etwa eine Fußlänge vor der Box stehen.", "Kurz ausholen, Arme nach hinten.", "Explosiv auf die Box springen und weich in der Hocke landen.", "Aufrichten und herabsteigen – nicht herunterspringen."],
      cues: ["Boxhöhe so wählen, dass die Landung sicher ist", "Leise landen", "Herabsteigen statt springen"],
      easier: "Niedrige Box", harder: "Höhere Box, aus dem Stand ohne Ausholen",
      poses: [{ t: 40, l1: [70, -24], l2: [74, -20], r1: [-55, -40], r2: [-50, -35], x: 26 }, { t: 34, l1: [72, -22], l2: [76, -18], r1: [75, 90], r2: [80, 95], x: 74, anchor: ["a1", 64] }],
      props: [{ t: "box", x: 58, y: 64, w: 34 }] },
    { id: "pogo", name: "Pogo-Sprünge", region: "sprung", equip: ["ohne"], level: 1, kind: "plyo",
      muscles: "Waden, Achillessehne, Fußmuskulatur",
      why: "Trainiert die Federwirkung des Fußgelenks – kurze, steife Bodenkontakte wie im Sprint.",
      steps: ["Aufrecht stehen, Knie fast gestreckt.", "Aus den Fußgelenken heraus schnell und federnd hüpfen.", "Nur auf dem Vorfuß landen, Bodenkontakt so kurz wie möglich."],
      cues: ["Knie bleiben fast gestreckt", "Fersen berühren den Boden nicht", "Rhythmisch und schnell"],
      easier: "Niedrige, langsame Hüpfer", harder: "Einbeinig oder höher",
      poses: [{ t: 2, l1: [3, -3], l2: [5, -1], r1: [-10, -5], r2: [-6, -2], f1: 50, f2: 50, anchor: ["t1", 92] }, { t: 0, l1: [0, 0], l2: [2, 2], r1: [12, 12], r2: [16, 16], f1: 22, f2: 22, anchor: ["t1", 82] }] },
    { id: "splitjump", name: "Ausfallschrittsprünge", region: "sprung", equip: ["ohne"], level: 2, kind: "plyo",
      muscles: "Oberschenkel, Gesäß, Hüftbeuger",
      why: "Schnellkraft in Schrittstellung mit Beinwechsel – nah an der Sprintbewegung.",
      steps: ["Ausfallschritt-Position einnehmen.", "Explosiv nach oben springen und in der Luft die Beine wechseln.", "Im Ausfallschritt mit dem anderen Bein vorn landen."],
      cues: ["Weich landen, Knie stabil", "Oberkörper aufrecht", "Arme gegengleich mitnehmen"],
      easier: "Mit Pause nach jeder Landung", harder: "Ohne Pause, höher springen",
      poses: [{ t: 4, l1: [82, -6], l2: [-22, -96], r1: [-40, -30], r2: [50, 70] }, { t: 0, l1: [22, 6], l2: [-14, -40], r1: [40, 70], r2: [-40, -30], anchor: ["a1", 80] }],
      ax: "p", x: 56 },
    { id: "plank", name: "Unterarmstütz (Plank)", region: "rumpf", equip: ["ohne"], level: 1, kind: "iso",
      muscles: "Gerade und tiefe Bauchmuskulatur, Schultern",
      why: "Rumpfstabilität überträgt die Kraft der Beine – weniger Ausweichbewegungen beim Laufen.",
      steps: ["Unterarme schulterbreit, Ellbogen unter den Schultern.", "Auf die Zehen kommen, Körper bildet eine gerade Linie.", "Bauch und Gesäß anspannen und halten."],
      cues: ["Kein Durchhängen, kein Hohlkreuz", "Kopf in Verlängerung der Wirbelsäule", "Ruhig atmen"],
      easier: "Auf den Knien", harder: "Ein Bein oder einen Arm abheben",
      poses: [{ t: 80, l1: [-97, -97], l2: [-95, -95], r1: [0, 90], r2: [4, 90], f1: 0, f2: 0 }],
      ax: "e1", x: 88 },
    { id: "seitstuetz", name: "Seitstütz", region: "rumpf", equip: ["ohne"], level: 1, kind: "iso", side: true,
      muscles: "Seitliche Bauchmuskulatur, Hüftabduktoren",
      why: "Seitliche Rumpfstabilität – hält das Becken im Sprint stabil.",
      steps: ["Seitlage, Ellbogen unter der Schulter, Beine gestreckt übereinander.", "Becken anheben, bis der Körper eine gerade Linie bildet.", "Position halten, Seite wechseln."],
      cues: ["Becken nicht absinken lassen", "Schultern und Hüfte in einer Ebene", "Oberer Arm in die Hüfte gestützt"],
      easier: "Knie gebeugt", harder: "Oberes Bein abspreizen",
      poses: [{ t: -92, l1: [90, 90], l2: [91, 91], r1: [0, 90], r2: [60, 150] }, { t: -74, l1: [105, 105], l2: [106, 106], r1: [0, 90], r2: [60, 150] }],
      ax: "e1", x: 24, view: "Frontansicht" },
    { id: "deadbug", name: "Dead Bug", region: "rumpf", equip: ["ohne"], level: 1, kind: "bw", side: true,
      muscles: "Tiefe Bauchmuskulatur, Hüftbeuger",
      why: "Lehrt, Arme und Beine gegengleich bei stabilem Rumpf zu bewegen – wie beim Laufen.",
      steps: ["Rückenlage, Arme senkrecht nach oben, Hüfte und Knie im rechten Winkel.", "Einen Arm nach hinten und das gegenüberliegende Bein nach vorn strecken.", "Zurück zur Mitte, Seite wechseln."],
      cues: ["Unterer Rücken bleibt am Boden", "Langsam und kontrolliert", "Ausatmen beim Strecken"],
      easier: "Nur die Beine bewegen", harder: "Mit leichter Kurzhantel in den Händen",
      poses: [{ t: -90, l1: [180, 90], l2: [178, 92], r1: [180, 180], r2: [178, 178] }, { t: -90, l1: [180, 90], l2: [96, 96], r1: [-96, -96], r2: [178, 178] }],
      ax: "p", x: 58 },
    { id: "birddog", name: "Bird Dog", region: "rumpf", equip: ["ohne"], level: 1, kind: "bw", side: true,
      muscles: "Rückenstrecker, Gesäß, tiefe Rumpfmuskulatur",
      why: "Stabilisiert Rücken und Becken bei gegengleicher Arm-Bein-Bewegung.",
      steps: ["Vierfüßlerstand: Hände unter den Schultern, Knie unter der Hüfte.", "Einen Arm nach vorn und das gegenüberliegende Bein nach hinten strecken.", "Kurz halten, zurückführen, Seite wechseln."],
      cues: ["Rücken bleibt flach – nicht ins Hohlkreuz", "Becken nicht verdrehen", "Langsam bewegen"],
      easier: "Nur Arm oder nur Bein", harder: "Ellbogen und Knie unter dem Bauch zusammenführen",
      poses: [{ t: 90, l1: [0, -90], l2: [2, -88], r1: [0, 0], r2: [2, 2] }, { t: 90, l1: [0, -90], l2: [-92, -92], r1: [96, 96], r2: [2, 2] }],
      ax: "k1", x: 42 },
    { id: "pallof", name: "Pallof Press", region: "rumpf", equip: ["band"], level: 1, kind: "bw", side: true,
      muscles: "Schräge Bauchmuskulatur, Rumpfstabilisatoren",
      why: "Anti-Rotation: Der Rumpf hält gegen Verdrehung – schützt den Rücken und spart Energie.",
      steps: ["Seitlich zum befestigten Band stehen, Griff vor der Brust.", "Arme langsam nach vorn strecken, ohne dass der Oberkörper mitdreht.", "Kurz halten, zur Brust zurückführen."],
      cues: ["Hüfte und Schultern zeigen nach vorn", "Gesäß und Bauch fest", "Abstand zum Befestigungspunkt bestimmt den Widerstand"],
      easier: "Näher an den Befestigungspunkt", harder: "Halbkniend oder im Ausfallschritt",
      poses: [{ t: 0, l1: [8, -6], l2: [-8, 4], r1: [20, 125], r2: [22, 125] }, { t: 0, l1: [8, -6], l2: [-8, 4], r1: [86, 90], r2: [88, 92] }],
      props: [{ t: "bandTo", at: "h1", x: 4, y: 52 }], ax: "a2", x: 58 },
    { id: "kneeraise", name: "Hängendes Knieheben", region: "rumpf", equip: ["stange"], level: 2, kind: "bw", cap: [6, 12],
      muscles: "Hüftbeuger, untere Bauchmuskulatur, Griffkraft",
      why: "Kräftigt den Kniehub – wichtig für eine hohe Schrittfrequenz.",
      steps: ["An der Stange hängen, Arme gestreckt.", "Knie kontrolliert bis mindestens Hüfthöhe ziehen.", "Langsam absenken, ohne Schwung."],
      cues: ["Nicht schaukeln", "Becken am Ende leicht einrollen", "Schultern aktiv nach unten"],
      easier: "Im Stütz an der Dipstation", harder: "Gestreckte Beine",
      poses: [{ t: 0, l1: [0, 0], l2: [3, 3], r1: [180, 180], r2: [180, 180], anchor: ["h1", 14] }, { t: -8, l1: [104, 10], l2: [106, 12], r1: [180, 180], r2: [180, 180], anchor: ["h1", 14] }],
      props: [{ t: "bar", y: 14 }], ax: "h1", x: 60 },
    { id: "superman", name: "Rückenstrecker (Superman)", region: "rumpf", equip: ["ohne"], level: 1, kind: "bw",
      muscles: "Rückenstrecker, Gesäß, hintere Schulter",
      why: "Gegenpart zur Bauchmuskulatur – für einen stabilen, belastbaren Rücken.",
      steps: ["Bauchlage, Arme nach vorn gestreckt.", "Arme, Brust und Beine gleichzeitig leicht vom Boden abheben.", "Kurz halten, kontrolliert ablegen."],
      cues: ["Blick zum Boden – Nacken lang", "Nur wenige Zentimeter anheben", "Gesäß anspannen"],
      easier: "Nur Arme oder nur Beine", harder: "Am Ende 3 s halten",
      poses: [{ t: 90, l1: [-90, -90], l2: [-90, -90], r1: [90, 90], r2: [90, 90], f1: 0, f2: 0 }, { t: 76, l1: [-100, -100], l2: [-100, -100], r1: [104, 104], r2: [104, 104], f1: 0, f2: 0 }],
      ax: "p", x: 56 },
    { id: "liegestuetz", name: "Liegestütz", region: "ober", equip: ["ohne"], level: 1, kind: "bw",
      muscles: "Brust, Trizeps, vordere Schulter, Rumpf",
      why: "Kräftigt Oberkörper und Rumpf gemeinsam – unterstützt den Armzug im Sprint.",
      steps: ["Hände etwas breiter als schulterbreit, Körper gestreckt.", "Brust kontrolliert bis knapp über den Boden absenken.", "Kraftvoll zurück nach oben drücken."],
      cues: ["Körper bleibt eine Linie", "Ellbogen etwa 45° zum Körper", "Volle Bewegungsweite"],
      easier: "Hände erhöht oder auf den Knien", harder: "Füße erhöht, explosiv mit Abheben",
      poses: [{ t: 66, l1: [-68, -68], l2: [-67, -67], r1: [0, 0], r2: [2, 2], f1: 0, f2: 0 }, { t: 82, l1: [-83, -83], l2: [-82, -82], r1: [-62, 40], r2: [-60, 42], f1: 0, f2: 0 }],
      ax: "h1", x: 86 },
    { id: "klimmzug", name: "Klimmzüge", region: "ober", equip: ["stange"], level: 3, kind: "bw", cap: [4, 8],
      muscles: "Breiter Rückenmuskel, Bizeps, Griffkraft",
      why: "Kräftigt Rücken und Arme – Ausgleich zu den vielen Druckübungen.",
      steps: ["Stange etwa schulterbreit greifen, Arme gestreckt hängen.", "Brust zur Stange ziehen, bis das Kinn darüber ist.", "Kontrolliert ganz absenken."],
      cues: ["Schulterblätter zuerst nach unten ziehen", "Kein Schwung", "Ganz ausstrecken am Ende"],
      easier: "Mit Band zur Unterstützung oder nur Absenken", harder: "Mit Zusatzgewicht",
      poses: [{ t: 0, l1: [6, -30], l2: [8, -28], r1: [180, 180], r2: [180, 180], anchor: ["h1", 14] }, { t: 0, l1: [6, -30], l2: [8, -28], r1: [28, 178], r2: [30, 178], anchor: ["h1", 14] }],
      props: [{ t: "bar", y: 14 }], ax: "h1", x: 60 },
    { id: "rudern", name: "Vorgebeugtes Rudern", region: "ober", equip: ["kh", "lh"], level: 2, kind: "load",
      muscles: "Oberer Rücken, hintere Schulter, Bizeps",
      why: "Stärkt den oberen Rücken und eine aufrechte Haltung.",
      steps: ["Hüftbreit stehen, Oberkörper weit vorgebeugt, Rücken gerade.", "Hanteln zum Bauch ziehen, Ellbogen nah am Körper.", "Kontrolliert absenken."],
      cues: ["Rücken bleibt gerade", "Schulterblätter zusammenziehen", "Kein Schwung aus der Hüfte"],
      easier: "Einarmig mit Abstützen auf der Bank", harder: "Schwerer, Pause oben",
      poses: [{ t: 70, l1: [16, -8], l2: [18, -6], r1: [0, 0], r2: [2, 2] }, { t: 70, l1: [16, -8], l2: [18, -6], r1: [-82, 0], r2: [-80, 2] }],
      props: [{ t: "db", at: "h1" }] },
    { id: "schulter", name: "Schulterdrücken", region: "ober", equip: ["kh"], level: 1, kind: "load",
      muscles: "Schulter, Trizeps, oberer Rücken",
      why: "Kräftigt die Schultern und stabilisiert den Armzug.",
      steps: ["Aufrecht stehen, Kurzhanteln auf Schulterhöhe.", "Hanteln senkrecht über den Kopf drücken.", "Kontrolliert auf Schulterhöhe zurück."],
      cues: ["Kein Hohlkreuz – Bauch fest", "Hanteln über den Schultern", "Kopf bleibt gerade"],
      easier: "Sitzend, leichtere Hanteln", harder: "Einarmig oder im Halbknien",
      poses: [{ t: 0, l1: [3, 0], l2: [-3, 0], r1: [20, 168], r2: [22, 168] }, { t: 0, l1: [3, 0], l2: [-3, 0], r1: [178, 180], r2: [180, 182] }],
      props: [{ t: "db", at: "h1" }] },
    { id: "bank", name: "Bankdrücken", region: "ober", equip: ["lh", "box"], level: 2, kind: "load",
      muscles: "Brust, Trizeps, vordere Schulter",
      why: "Kräftige Brust und Arme für einen kraftvollen Armeinsatz.",
      steps: ["Rückenlage auf der Bank, Füße fest am Boden.", "Hantel etwas breiter als schulterbreit greifen.", "Kontrolliert zur Brust senken, dann nach oben drücken."],
      cues: ["Schulterblätter zusammen und unten", "Gesäß bleibt auf der Bank", "Mit Partner sichern"],
      easier: "Mit Kurzhanteln, leichter", harder: "Schwerer, Pause auf der Brust",
      poses: [{ t: -90, l1: [90, -4], l2: [92, -2], r1: [-30, 178], r2: [-28, 178] }, { t: -90, l1: [90, -4], l2: [92, -2], r1: [180, 180], r2: [180, 180] }],
      props: [{ t: "plate", at: "h1" }, { t: "bench", at: "p", from: "s" }], ax: "a1", x: 92, anchor: ["a1", 92] },
    { id: "kbswing", name: "Kettlebell-Swing", region: "ganz", equip: ["kb"], level: 2, kind: "power",
      muscles: "Gesäß, Oberschenkel hinten, Rücken",
      why: "Explosive Hüftstreckung – überträgt sich auf Sprint und Sprung.",
      steps: ["Schulterbreit stehen, Kettlebell mit beiden Händen.", "Hüfte nach hinten schieben, Kettlebell zwischen den Beinen nach hinten schwingen.", "Hüfte explosiv nach vorn strecken, die Kettlebell schwingt bis Brusthöhe.", "Rhythmisch wiederholen."],
      cues: ["Bewegung aus der Hüfte, nicht aus den Armen", "Rücken gerade", "Oben Gesäß fest anspannen"],
      easier: "Leichtere Kettlebell, weniger Schwung", harder: "Schwerer, einarmig",
      poses: [{ t: 66, l1: [20, -8], l2: [22, -6], r1: [-14, -14], r2: [-12, -12] }, { t: 0, l1: [3, 0], l2: [5, 2], r1: [88, 90], r2: [90, 92] }],
      props: [{ t: "kb", at: "h1" }] },
    { id: "mbwurf", name: "Medizinball-Wurf rückwärts", region: "ganz", equip: ["ball"], level: 2, kind: "power",
      muscles: "Gesamte Streckkette: Beine, Gesäß, Rücken",
      why: "Explosive Ganzkörperstreckung – wie beim Start und Absprung.",
      steps: ["Ball mit beiden Händen, schulterbreit stehen.", "In die Hocke gehen, Ball zwischen den Beinen.", "Explosiv strecken und den Ball über den Kopf nach hinten werfen.", "Ball holen, neu ansetzen."],
      cues: ["Freie Wurfzone hinter dir", "Streckung aus den Beinen, Arme führen nur", "Jeder Wurf maximal"],
      easier: "Leichter Ball, aus dem Stand", harder: "Schwerer Ball, mit Strecksprung",
      poses: [{ t: 48, l1: [62, -26], l2: [66, -22], r1: [8, 6], r2: [10, 8] }, { t: -14, l1: [-4, -2], l2: [-2, 0], r1: [204, 206], r2: [206, 208], f1: 40, f2: 40, anchor: ["t1", 92] }],
      props: [{ t: "ball", at: "h1" }] },
  ];
  const BY_ID = new Map(EX.map((e) => [e.id, e]));

  /* ---------- Skizze: Strichfigur aus Gelenkwinkeln ----------
     Blick von der Seite, Figur schaut nach rechts. Winkel in Grad:
     t = Oberkörper ab senkrecht nach oben (+ = vorgebeugt), Beine/Arme ab senkrecht nach unten (+ = nach vorn).
     l1/l2 = [Oberschenkel, Unterschenkel] nah/fern, r1/r2 = [Oberarm, Unterarm], f1/f2 = Fuß (Standard 90 = waagerecht). */
  const LEN = { trunk: 20, thigh: 17, shank: 17, upper: 11, fore: 10, head: 7.6, foot: 5 }, FLOOR = 92;
  const rad = (d) => (d * Math.PI) / 180;
  const add = (p, len, ang, up) => [p[0] + len * Math.sin(rad(ang)), p[1] + (up ? -1 : 1) * len * Math.cos(rad(ang))];
  function rawJoints(q) {
    const p = [0, 0], s = add(p, LEN.trunk, q.t, true), J = { p, s, hd: add(s, LEN.head, q.t, true) };
    [[1, q.l1, q.f1], [2, q.l2, q.f2]].forEach(([i, l, f]) => {
      J["k" + i] = add(p, LEN.thigh, l[0]); J["a" + i] = add(J["k" + i], LEN.shank, l[1]);
      J["t" + i] = q.front ? J["a" + i] : add(J["a" + i], LEN.foot, f == null ? 90 : f);
    });
    [[1, q.r1], [2, q.r2]].forEach(([i, r]) => { J["e" + i] = add(s, LEN.upper, r[0]); J["h" + i] = add(J["e" + i], LEN.fore, r[1]); });
    return J;
  }
  function offset(q, J, ex) {
    const anchor = q.anchor || ex.anchor;
    let dy;
    if (anchor) dy = anchor[1] - J[anchor[0]][1];
    else dy = FLOOR - Math.max(...Object.keys(J).map((k) => J[k][1] + (k === "hd" ? 4.6 : 0)));
    const ax = ex.ax || "a1", x = q.x != null ? q.x : ex.x != null ? ex.x : 52;
    return [x - J[ax][0], dy];
  }
  function lerpPose(a, b, t) {
    const m = (x, y) => x + (y - x) * t, ml = (x, y) => [m(x[0], y[0]), m(x[1], y[1])];
    return { t: m(a.t, b.t), l1: ml(a.l1, b.l1), l2: ml(a.l2, b.l2), r1: ml(a.r1, b.r1), r2: ml(a.r2, b.r2),
      f1: m(a.f1 == null ? 90 : a.f1, b.f1 == null ? 90 : b.f1), f2: m(a.f2 == null ? 90 : a.f2, b.f2 == null ? 90 : b.f2), front: a.front };
  }
  /** Gelenke einer Pose (bzw. Zwischenstand t zwischen Start und Ende), bereits auf den Boden gestellt. */
  function poseJoints(ex, t) {
    const A = ex.poses[0], B = ex.poses[1] || A;
    const JA = rawJoints(A), JB = rawJoints(B), oA = offset(A, JA, ex), oB = offset(B, JB, ex);
    const q = t <= 0 ? A : t >= 1 ? B : lerpPose(A, B, t), J = t <= 0 ? JA : t >= 1 ? JB : rawJoints(q);
    const o = [oA[0] + (oB[0] - oA[0]) * t, oA[1] + (oB[1] - oA[1]) * t], out = {};
    Object.keys(J).forEach((k) => { out[k] = [J[k][0] + o[0], J[k][1] + o[1]]; });
    return out;
  }
  const f1 = (n) => Math.round(n * 10) / 10;
  const line = (a, b, w, c) => '<line x1="' + f1(a[0]) + '" y1="' + f1(a[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1]) + '" style="stroke:' + c + '" stroke-width="' + w + '" stroke-linecap="round"/>';
  function figure(J, ghost) {
    const ink = ghost ? "var(--muted)" : "var(--ink)", far = "var(--muted)", op = ghost ? ' opacity=".35"' : "";
    let g = "<g" + op + ">";
    // ferne Gliedmaßen zuerst (heller)
    g += line(J.p, J.k2, 3.2, far) + line(J.k2, J.a2, 3.2, far) + line(J.a2, J.t2, 2.6, far);
    g += line(J.s, J.e2, 3, far) + line(J.e2, J.h2, 3, far);
    g += line(J.p, J.s, 4, ink);
    g += line(J.p, J.k1, 3.6, ink) + line(J.k1, J.a1, 3.6, ink) + line(J.a1, J.t1, 3, ink);
    g += line(J.s, J.e1, 3.4, ink) + line(J.e1, J.h1, 3.4, ink);
    g += '<circle cx="' + f1(J.hd[0]) + '" cy="' + f1(J.hd[1]) + '" r="4.6" style="fill:' + ink + '"/>';
    return g + "</g>";
  }
  function props(ex, J, J0, J1) {
    const eq = "var(--clay)";
    let g = "";
    (ex.props || []).forEach((p) => {
      const ref = p.ref === 1 ? J1 : J0, at = p.at ? J[p.at] : null, sa = p.at ? ref[p.at] : null;
      if (p.t === "plate" && at) g += '<circle cx="' + f1(at[0] + (p.dx || 0)) + '" cy="' + f1(at[1] + (p.dy || 0)) + '" r="6.5" style="fill:none;stroke:' + eq + '" stroke-width="3"/>';
      if (p.t === "db" && at) g += '<rect x="' + f1(at[0] - 5) + '" y="' + f1(at[1] - 2.2) + '" width="10" height="4.4" rx="1.5" style="fill:' + eq + '"/>';
      if (p.t === "kb" && at) g += '<circle cx="' + f1(at[0]) + '" cy="' + f1(at[1] + 5) + '" r="4.6" style="fill:' + eq + '"/>';
      if (p.t === "ball" && at) g += '<circle cx="' + f1(at[0]) + '" cy="' + f1(at[1]) + '" r="5.5" style="fill:' + eq + '"/>';
      if (p.t === "pad" && at) g += '<rect x="' + f1(at[0] - 4) + '" y="' + f1(at[1] - 7) + '" width="8" height="5" rx="1.5" style="fill:' + eq + '"/>';
      if (p.t === "box") g += '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + (FLOOR - p.y) + '" rx="2" style="fill:none;stroke:' + eq + '" stroke-width="2.5"/>';
      if (p.t === "boxUnder" && sa) { const top = sa[1] + (p.dy || 3), x = sa[0] - p.w / 2 + (p.dx || 0);
        g += '<rect x="' + f1(x) + '" y="' + f1(top) + '" width="' + p.w + '" height="' + f1(FLOOR - top) + '" rx="2" style="fill:none;stroke:' + eq + '" stroke-width="2.5"/>'; }
      if (p.t === "bench") { const a = ref[p.from], b = ref[p.at], top = Math.max(a[1], b[1]) + 4;
        g += '<rect x="' + f1(a[0] - 8) + '" y="' + f1(top) + '" width="' + f1(b[0] - a[0] + 12) + '" height="5" rx="2" style="fill:none;stroke:' + eq + '" stroke-width="2.5"/>'
          + line([b[0] - 2, top + 5], [b[0] - 2, FLOOR], 2.5, eq) + line([a[0] - 4, top + 5], [a[0] - 4, FLOOR], 2.5, eq); }
      if (p.t === "bar") g += line([30, p.y], [90, p.y], 3, eq);
      if (p.t === "wall") g += line([p.x, 20], [p.x, FLOOR], 3, "var(--line)");
      if (p.t === "bandK") g += line(J.k1, J.k2, 2.5, eq);
      if (p.t === "bandTo" && at) g += line(at, [p.x, p.y], 2, eq) + line([p.x - 2, p.y - 6], [p.x - 2, p.y + 6], 3, "var(--line)");
    });
    return g;
  }
  /** SVG-Skizze. t = null: Start blass + Ende kräftig; t = 0…1: Zwischenstand für die Animation. */
  function sketch(ex, t, label) {
    const J0 = poseJoints(ex, 0), J1 = poseJoints(ex, 1), still = !ex.poses[1];
    let g = line([4, FLOOR + 1.5], [116, FLOOR + 1.5], 2, "var(--line)");
    if (t == null) { g += props(ex, J1, J0, J1); if (!still) g += figure(J0, true); g += figure(J1, false); }
    else { const J = poseJoints(ex, t); g += props(ex, J, J0, J1) + figure(J, false); }
    return '<svg viewBox="0 0 120 100" role="img" aria-label="' + (label || ex.name) + '">' + g + "</svg>";
  }

  /* ---------- Belastungsempfehlung ---------- */
  // [Serien, Wdh. von, bis, Pause s, Hinweis]
  const BASE = {
    load: { ka: [3, 15, 20, 60, "leicht, RPE 6 (ca. 50–60 %)"], hyp: [3, 8, 12, 90, "RPE 7–8 (ca. 65–80 %)"], max: [4, 3, 5, 180, "schwer, RPE 8–9 (ca. 85–90 %)"], sk: [4, 4, 6, 150, "explosiv, ca. 30–60 % – jede Wdh. maximal schnell"] },
    bw: { ka: [3, 15, 20, 45, "zügig, sauber"], hyp: [3, 10, 15, 75, "langsam absenken (2–3 s)"], max: [4, 5, 8, 150, "schwerere Variante oder Zusatzgewicht"], sk: [4, 5, 8, 120, "explosiv in der Aufwärtsphase"] },
    iso: { ka: [3, 45, 45, 45, "ruhig atmen"], hyp: [3, 30, 40, 60, "maximale Spannung"], max: [4, 10, 15, 90, "schwerere Variante"], sk: [3, 20, 20, 60, "kurz und fest"] },
    plyo: { ka: [3, 10, 10, 90, "rhythmisch, kurze Bodenkontakte"], hyp: [3, 8, 8, 120, "maximal explosiv"], max: [4, 5, 5, 150, "maximal hoch/weit, volle Pause"], sk: [4, 6, 6, 150, "maximal explosiv, kurze Bodenkontakte"] },
    power: { ka: [3, 12, 15, 60, "rhythmisch"], hyp: [4, 8, 10, 90, "kraftvoll"], max: [5, 4, 5, 150, "schwer und explosiv"], sk: [5, 5, 5, 120, "jede Wdh. maximal explosiv"] },
  };
  const UNIT = { load: "Wdh.", bw: "Wdh.", iso: "s", plyo: "Sprünge", power: "Wdh." };
  /** Empfehlung aus Ziel, Niveau, Trainingsphase und Alter. */
  function dose(ex, cfg, age) {
    const c = Object.assign({}, DEFAULTS, cfg || {}), b = BASE[ex.kind][c.goal] || BASE[ex.kind].hyp;
    let [sets, lo, hi, rest, hint] = b;
    const notes = [];
    if (c.level === "ein") { sets = Math.max(2, sets - 1); hi = lo + Math.round((hi - lo) / 2); if (ex.kind === "plyo") { lo = hi = Math.max(4, Math.round(lo * 0.7)); } notes.push("Einsteiger: weniger Serien"); }
    if (c.level === "leist") { sets = Math.min(6, sets + 1); notes.push("Leistungssport: eine Serie mehr"); }
    if (c.phase === "wk") { sets = Math.max(2, sets - 1); if (ex.kind === "plyo") { lo = hi = Math.max(3, Math.round(lo * 0.7)); } notes.push("Wettkampfphase: Umfang reduziert, Intensität halten"); }
    if (c.phase === "reg") { sets = 2; if (ex.kind === "load") hint = "locker, ca. 60 %"; notes.push("Übergang: locker, Fokus auf Technik"); }
    if (age != null && age >= 50) { rest += 30; if (ex.kind === "plyo") { lo = hi = Math.max(3, Math.round(lo * 0.75)); } notes.push("Masters 50+: längere Pausen" + (ex.kind === "plyo" ? ", weniger Sprünge" : "")); }
    if (age != null && age >= 60 && ex.kind === "plyo") sets = Math.max(2, sets - 1);
    if (ex.cap) { lo = Math.min(lo, ex.cap[0]); hi = Math.max(lo, Math.min(hi, ex.cap[1])); }
    if (ex.kind === "iso") { lo = Math.round(lo / 5) * 5; hi = Math.round(hi / 5) * 5; }
    return { sets, reps: lo === hi ? String(lo) : lo + "–" + hi, unit: UNIT[ex.kind], side: !!ex.side, rest, hint, notes };
  }
  const fmtRest = (s) => (s >= 60 ? (s % 60 ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + " min" : s / 60 + " min") : s + " s");

  window.LA_KRAFT = { REGIONS, EQUIP, GOALS, LEVELS, PHASES, DEFAULTS, EX, BY_ID, sketch, poseJoints, dose, fmtRest, UNIT };
})();
