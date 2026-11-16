/**
 * Data-Layer für Aktenverwaltung (Cloudflare D1 REST-API vorbereitet + localStorage Fallback)
 */
const AktenAPI = (() => {
    const STORAGE_KEY = 'justiz_berlin_akten_v1';
    const API_BASE = '/api/akten';
    const USE_REMOTE_API = false; // Bei Produktivbetrieb mit Cloudflare D1 auf true setzen

    const DEFAULT_AKTEN = [
        {
            az: '204/26 StA',
            datum: '12.11.2026',
            typ: 'Strafanzeige / Ermittlungsakte der Polizei',
            vorname: 'Kriminalhauptkommissar',
            nachname: 'Weber',
            behoerde: 'Polizei Berlin – LKA 41',
            beteiligter: 'Unbekannt (Fahrzeugkennzeichen B-RP 409)',
            sachverhalt: 'Schwerer Bandendiebstahl eines gepanzerten Werttransporters im Bereich Tiergarten. Videoaufzeichnungen der BVG liegen der Akte bei.',
            status: 'In staatsanwaltschaftlicher Prüfung',
            vermerk: 'Auswertung der Funkzellenabfrage läuft. Vorlage bei Dezernat 42 am 18.11.2026.'
        },
        {
            az: '12/26 VS',
            datum: '08.11.2026',
            typ: 'Zivilrechtliche Schlichtung / Verbraucherschutz-Beschwerde',
            vorname: 'Sabine',
            nachname: 'Krüger',
            behoerde: 'Prenzlauer Allee 44, 10405 Berlin',
            beteiligter: 'Autohaus Spreeblick GmbH',
            sachverhalt: 'Widerruf eines Kaufvertrages über ein Gebrauchtfahrzeug wegen verschwiegener Unfallschäden. Händler verweigert Rückabwicklung.',
            status: 'Eingegangen',
            vermerk: 'Eingangsbestätigung versandt. Stellungnahme der Gegenseite angefordert.'
        },
        {
            az: '88/26 AG',
            datum: '03.11.2026',
            typ: 'Antrag auf Haftbefehl / Durchsuchungsbeschluss',
            vorname: 'Oberstaatsanwalt',
            nachname: 'Richter',
            behoerde: 'Staatsanwaltschaft Berlin – Abt. Organisierte Kriminalität',
            beteiligter: 'Viktor K. (geb. 14.05.1988)',
            sachverhalt: 'Antrag auf Erlass eines Durchsuchungsbeschlusses für die Geschäftsräume in der Kurfürstenstraße 112 wegen Verdachts des gewerbsmäßigen Betruges.',
            status: 'Beschluss erlassen',
            vermerk: 'Durchsuchungsbeschluss durch Ermittlungsrichter am Amtsgericht Tiergarten unterzeichnet.'
        }
    ];

    function loadLocal() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_AKTEN));
                return [...DEFAULT_AKTEN];
            }
            return JSON.parse(raw);
        } catch {
            return [...DEFAULT_AKTEN];
        }
    }

    function saveLocal(akten) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(akten));
        } catch (e) {
            console.error('Speichern im localStorage fehlgeschlagen:', e);
        }
    }

    async function getAll() {
        if (USE_REMOTE_API) {
            try {
                const res = await fetch(API_BASE);
                if (res.ok) return await res.json();
            } catch {
                // Fallback auf localStorage
            }
        }
        return loadLocal();
    }

    async function create(akte) {
        if (USE_REMOTE_API) {
            try {
                const res = await fetch(API_BASE, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(akte)
                });
                if (res.ok) return await res.json();
            } catch {
                // Fallback auf localStorage
            }
        }
        const akten = loadLocal();
        akten.unshift(akte);
        saveLocal(akten);
        return akte;
    }

    async function update(az, patch) {
        if (USE_REMOTE_API) {
            try {
                const res = await fetch(`${API_BASE}/${encodeURIComponent(az)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patch)
                });
                if (res.ok) return await res.json();
            } catch {
                // Fallback auf localStorage
            }
        }
        const akten = loadLocal();
        const idx = akten.findIndex(a => a.az === az);
        if (idx !== -1) {
            akten[idx] = { ...akten[idx], ...patch };
            saveLocal(akten);
            return akten[idx];
        }
        return null;
    }

    function generateAktenzeichen(typ) {
        const num = Math.floor(100 + Math.random() * 899);
        let suffix = 'JustV';
        if (typ.includes('Strafanzeige')) suffix = 'StA';
        else if (typ.includes('Haftbefehl')) suffix = 'AG';
        else if (typ.includes('Schlichtung')) suffix = 'VS';
        else if (typ.includes('Schöffe')) suffix = 'Schö';
        return `${num}/26 ${suffix}`;
    }

    return {
        getAll,
        create,
        update,
        generateAktenzeichen
    };
})();
