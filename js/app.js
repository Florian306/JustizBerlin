document.addEventListener('DOMContentLoaded', () => {
    // Demo-Zugangsdaten für das interne Dienstportal
    const DEMO_USER = 'justiz-berlin';
    const DEMO_PASS = 'SenJust2026!';

    let currentSelectedAz = null;
    let isLoggedIn = false;

    // --- Tab-Navigation ---
    const navTabs = document.querySelectorAll('.nav-tab');
    const tabPanels = document.querySelectorAll('.tab-panel');

    function switchTab(tabId) {
        navTabs.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === `tab-${tabId}`);
        });
        if (tabId === 'intern' && isLoggedIn) {
            renderInternTable();
        }
    }

    navTabs.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Schnellzugriff-Kacheln auf der Startseite
    document.querySelectorAll('.quick-tab-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(link.dataset.tab);
        });
    });

    // Direktlinks von der Startseite zum Service-Formular
    document.querySelectorAll('.quick-nav').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const preset = link.dataset.preset;
            const select = document.getElementById('antrag-typ');
            const map = {
                strafanzeige: 'Strafanzeige / Ermittlungsakte der Polizei',
                haftbefehl: 'Antrag auf Haftbefehl / Durchsuchungsbeschluss',
                schlichtung: 'Zivilrechtliche Schlichtung / Verbraucherschutz-Beschwerde',
                schoeffe: 'Bewerbung als ehrenamtliche/r Schöffe/in'
            };
            if (map[preset]) select.value = map[preset];
            switchTab('service');
        });
    });

    // --- Startseite: Kennzahlen, Schnellabfrage & Bekanntmachungen ---
    async function updateStats() {
        const akten = await AktenAPI.getAll();
        const total = akten.length;
        const open = akten.filter(a => a.status === 'Eingegangen' || a.status === 'In staatsanwaltschaftlicher Prüfung').length;
        const beschluss = akten.filter(a => a.status === 'Beschluss erlassen' || a.status === 'Anklage erhoben').length;

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-open').textContent = open;
        document.getElementById('stat-beschluss').textContent = beschluss;
    }

    updateStats();

    document.getElementById('card-quick-search').addEventListener('submit', (e) => {
        e.preventDefault();
        const az = document.getElementById('card-quick-az').value.trim();
        if (az) {
            document.getElementById('auskunft-az').value = az;
            switchTab('auskunft');
            document.getElementById('auskunft-nachname').focus();
        }
    });

    const BEKANNTMACHUNGEN = {
        justizreform: {
            title: 'Justizreform Berlin (Az. JustV I A 1)',
            text: 'Mit Wirkung zum 01.12.2026 werden sämtliche Ermittlungsverfahren wegen komplexer Wirtschaftskriminalität im Bezirk Tiergarten sowie Mitte zentral bei der Schwerpunktstaatsanwaltschaft am Landgericht Berlin I gebündelt.'
        },
        schoeffen: {
            title: 'Schöffenwahl 2026/2027 (Az. JustV II B 4)',
            text: 'Bürgerinnen und Bürger mit Hauptwohnsitz in Berlin können sich ab sofort über das Online-Antragsportal für das Ehrenamt als Schöffin oder Schöffe am Amtsgericht Tiergarten bewerben.'
        },
        verbraucherschutz: {
            title: 'Verbraucherschutz-Warnung (Az. VS III C 2)',
            text: 'Derzeit kursieren gefälschte Zahlungsaufforderungen angeblicher Inkassobüros. Prüfen Sie Forderungen sorgfältig und melden Sie unberechtigte Mahnungen über die Schlichtungsstelle.'
        },
        gebuehren: {
            title: 'Verordnung über die Gerichtsvollzieherkosten (GVBl. S. 412)',
            text: 'Die aktualisierte Gebührentabelle für Zustellungen und Zwangsvollstreckungen tritt zum 01.12.2026 in Kraft und ist in den Rechtsantragstellen einsehbar.'
        }
    };

    document.querySelectorAll('#bekanntmachungen-table tbody tr').forEach(row => {
        row.addEventListener('click', () => {
            const key = row.dataset.bekanntmachung;
            const info = BEKANNTMACHUNGEN[key];
            if (!info) return;
            document.getElementById('bekanntmachung-detail-title').textContent = info.title;
            document.getElementById('bekanntmachung-detail-text').textContent = info.text;
            document.getElementById('bekanntmachung-detail').classList.remove('hidden');
        });
    });

    document.getElementById('close-bekanntmachung').addEventListener('click', () => {
        document.getElementById('bekanntmachung-detail').classList.add('hidden');
    });

    // Header-Suchleiste -> springt zur Aktenauskunft
    document.getElementById('header-search-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('header-search-input').value.trim();
        if (query) {
            document.getElementById('auskunft-az').value = query;
            switchTab('auskunft');
            document.getElementById('auskunft-nachname').focus();
        }
    });

    // --- TAB 2: Online-Antrag einreichen ---
    const antragForm = document.getElementById('antrag-form');
    const confBox = document.getElementById('antrag-bestaetigung');

    antragForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const typ = document.getElementById('antrag-typ').value;
        const vorname = document.getElementById('antrag-vorname').value.trim();
        const nachname = document.getElementById('antrag-nachname').value.trim();
        const behoerde = document.getElementById('antrag-behoerde').value.trim() || 'Keine Angabe';
        const beteiligter = document.getElementById('antrag-beteiligter').value.trim() || 'Keine Angabe';
        const sachverhalt = document.getElementById('antrag-sachverhalt').value.trim();

        const az = AktenAPI.generateAktenzeichen(typ);
        const heute = new Date().toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const neueAkte = {
            az,
            datum: heute,
            typ,
            vorname,
            nachname,
            behoerde,
            beteiligter,
            sachverhalt,
            status: 'Eingegangen',
            vermerk: 'Elektronisch über Bürger-/Polizei-Service eingereicht.'
        };

        await AktenAPI.create(neueAkte);

        document.getElementById('conf-az').textContent = az;
        document.getElementById('conf-name').textContent = `${vorname} ${nachname}`;
        document.getElementById('conf-typ').textContent = typ;
        document.getElementById('conf-datum').textContent = heute;

        confBox.classList.remove('hidden');
        antragForm.reset();
        confBox.scrollIntoView({ behavior: 'smooth' });
    });

    // --- TAB 3: Vorgangs- & Aktenauskunft ---
    const auskunftForm = document.getElementById('auskunft-form');
    const auskunftErgebnis = document.getElementById('auskunft-ergebnis');

    auskunftForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const azInput = document.getElementById('auskunft-az').value.trim().toLowerCase();
        const nameInput = document.getElementById('auskunft-nachname').value.trim().toLowerCase();

        const akten = await AktenAPI.getAll();
        const treffer = akten.find(a =>
            a.az.toLowerCase() === azInput &&
            a.nachname.toLowerCase() === nameInput
        );

        auskunftErgebnis.classList.remove('hidden');

        if (!treffer) {
            auskunftErgebnis.innerHTML = `
                <h3>Kein Vorgang gefunden</h3>
                <p>Unter dem Aktenzeichen <strong>${escapeHtml(document.getElementById('auskunft-az').value)}</strong> in Verbindung mit dem angegebenen Nachnamen konnte kein Vorgang ermittelt werden. Bitte prüfen Sie Ihre Eingaben.</p>
            `;
            return;
        }

        auskunftErgebnis.innerHTML = `
            <h3>Auskunft zum Vorgang ${escapeHtml(treffer.az)}</h3>
            <table class="compact-table">
                <tbody>
                    <tr><th>Aktenzeichen:</th><td class="mono-bold">${escapeHtml(treffer.az)}</td></tr>
                    <tr><th>Eingangsdatum:</th><td>${escapeHtml(treffer.datum)}</td></tr>
                    <tr><th>Vorgangsart:</th><td>${escapeHtml(treffer.typ)}</td></tr>
                    <tr><th>Aktueller Bearbeitungsstatus:</th><td><strong>${escapeHtml(treffer.status)}</strong></td></tr>
                </tbody>
            </table>
            <p class="mt-10"><strong>Amtlicher Hinweis:</strong> ${getStatusHinweis(treffer.status)}</p>
        `;
    });

    function getStatusHinweis(status) {
        switch (status) {
            case 'Eingegangen':
                return 'Ihr Vorgang ist bei der zuständigen Geschäftsstelle eingegangen und wartet auf Zuweisung an ein Dezernat.';
            case 'In staatsanwaltschaftlicher Prüfung':
                return 'Die Akte befindet sich derzeit in der rechtlichen Prüfung durch die Staatsanwaltschaft Berlin.';
            case 'Anklage erhoben':
                return 'Die Staatsanwaltschaft hat Anklage beim zuständigen Gericht erhoben.';
            case 'Beschluss erlassen':
                return 'In dieser Sache wurde ein gerichtlicher Beschluss erlassen. Die Zustellung erfolgt gesondert.';
            case 'Eingestellt':
                return 'Das Verfahren wurde gemäß den gesetzlichen Bestimmungen eingestellt.';
            default:
                return 'Vorgang in Bearbeitung.';
        }
    }

    // --- TAB 4: Internes Dienstportal ---
    const loginView = document.getElementById('intern-login-view');
    const dashboardView = document.getElementById('intern-dashboard-view');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('login-user').value.trim();
        const pass = document.getElementById('login-pass').value;

        if (user === DEMO_USER && pass === DEMO_PASS) {
            isLoggedIn = true;
            loginError.classList.add('hidden');
            loginView.classList.add('hidden');
            dashboardView.classList.remove('hidden');
            document.getElementById('logged-user-display').textContent = user;
            renderInternTable();
        } else {
            loginError.classList.remove('hidden');
        }
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        isLoggedIn = false;
        currentSelectedAz = null;
        document.getElementById('intern-detail-panel').classList.add('hidden');
        dashboardView.classList.add('hidden');
        loginView.classList.remove('hidden');
        loginForm.reset();
    });

    document.getElementById('filter-status').addEventListener('change', renderInternTable);
    document.getElementById('filter-search').addEventListener('input', renderInternTable);

    async function renderInternTable() {
        const tbody = document.getElementById('intern-akten-tbody');
        const statusFilter = document.getElementById('filter-status').value;
        const searchFilter = document.getElementById('filter-search').value.trim().toLowerCase();

        const akten = await AktenAPI.getAll();
        const gefiltert = akten.filter(a => {
            const matchStatus = statusFilter === 'alle' || a.status === statusFilter;
            const matchSearch = !searchFilter ||
                a.az.toLowerCase().includes(searchFilter) ||
                a.nachname.toLowerCase().includes(searchFilter) ||
                a.behoerde.toLowerCase().includes(searchFilter) ||
                a.typ.toLowerCase().includes(searchFilter);
            return matchStatus && matchSearch;
        });

        tbody.innerHTML = '';

        if (gefiltert.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">Keine passenden Akten gefunden.</td></tr>';
            return;
        }

        gefiltert.forEach(akte => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="mono-bold">${escapeHtml(akte.az)}</td>
                <td>${escapeHtml(akte.datum)}</td>
                <td>${escapeHtml(akte.vorname)} ${escapeHtml(akte.nachname)}<br><small>${escapeHtml(akte.behoerde)}</small></td>
                <td>${escapeHtml(akte.typ)}</td>
                <td><strong>${escapeHtml(akte.status)}</strong></td>
                <td><button type="button" class="btn-secondary btn-small btn-open-akte" data-az="${escapeHtml(akte.az)}">Bearbeiten</button></td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-open-akte').forEach(btn => {
            btn.addEventListener('click', () => openAkteDetail(btn.dataset.az));
        });
    }

    async function openAkteDetail(az) {
        const akten = await AktenAPI.getAll();
        const akte = akten.find(a => a.az === az);
        if (!akte) return;

        currentSelectedAz = az;
        document.getElementById('detail-az').textContent = akte.az;
        document.getElementById('detail-name').textContent = `${akte.vorname} ${akte.nachname}`;
        document.getElementById('detail-behoerde').textContent = akte.behoerde;
        document.getElementById('detail-beteiligter').textContent = akte.beteiligter;
        document.getElementById('detail-sachverhalt').textContent = akte.sachverhalt;
        document.getElementById('detail-status-select').value = akte.status;
        document.getElementById('detail-vermerk').value = akte.vermerk || '';
        document.getElementById('save-feedback').classList.add('hidden');

        const panel = document.getElementById('intern-detail-panel');
        panel.classList.remove('hidden');
        panel.scrollIntoView({ behavior: 'smooth' });
    }

    document.getElementById('btn-save-akte').addEventListener('click', async () => {
        if (!currentSelectedAz) return;
        const status = document.getElementById('detail-status-select').value;
        const vermerk = document.getElementById('detail-vermerk').value;

        await AktenAPI.update(currentSelectedAz, { status, vermerk });
        document.getElementById('save-feedback').classList.remove('hidden');
        renderInternTable();
    });

    // --- Amtlicher Dokumenten-Generator (PDF / Print) ---
    document.getElementById('btn-print-doc').addEventListener('click', async () => {
        if (!currentSelectedAz) return;
        const akten = await AktenAPI.getAll();
        const akte = akten.find(a => a.az === currentSelectedAz);
        if (!akte) return;

        const docType = document.getElementById('doc-type-select').value;
        const heute = new Date().toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        document.getElementById('print-az').textContent = akte.az;
        document.getElementById('print-datum').textContent = heute;
        document.getElementById('print-doc-title').textContent = docType.toUpperCase();

        const bodyEl = document.getElementById('print-doc-body');
        const signerEl = document.getElementById('print-signer');

        if (docType === 'Haftbefehl') {
            signerEl.textContent = 'Richter/in am Amtsgericht Tiergarten';
            bodyEl.innerHTML = `
                <p>In dem Ermittlungsverfahren gegen <strong>${escapeHtml(akte.beteiligter)}</strong> wird auf Antrag der Staatsanwaltschaft Berlin die Untersuchungshaft angeordnet.</p>
                <p><strong>Gründe:</strong><br>${escapeHtml(akte.sachverhalt)}</p>
                <p>Es besteht dringender Tatverdacht sowie der Haftgrund der Fluchtgefahr (§ 112 Abs. 2 Nr. 2 StPO). Die Vollstreckung obliegt der Polizei Berlin.</p>
            `;
        } else if (docType === 'Durchsuchungsbeschluss') {
            signerEl.textContent = 'Ermittlungsrichter/in am Amtsgericht Tiergarten';
            bodyEl.innerHTML = `
                <p>In der Ermittlungssache betreffend <strong>${escapeHtml(akte.beteiligter)}</strong> wird gemäß §§ 102, 105 StPO die Durchsuchung der Wohn- und Geschäftsräume sowie der mitgeführten Fahrzeuge angeordnet.</p>
                <p><strong>Sachverhalt:</strong><br>${escapeHtml(akte.sachverhalt)}</p>
                <p>Zweck der Maßnahme ist das Auffinden von Beweismitteln. Die Beschlagnahme verfahrensrelevanter Gegenstände wird hiermit angeordnet.</p>
            `;
        } else if (docType === 'Strafbefehl') {
            signerEl.textContent = 'Richter/in am Amtsgericht Tiergarten';
            bodyEl.innerHTML = `
                <p>Auf Antrag der Staatsanwaltschaft Berlin wird gegen <strong>${escapeHtml(akte.beteiligter)}</strong> gemäß § 407 StPO eine Geldstrafe festgesetzt.</p>
                <p><strong>Tatvorwurf:</strong><br>${escapeHtml(akte.sachverhalt)}</p>
                <p>Gegen diesen Strafbefehl kann innerhalb von zwei Wochen nach Zustellung schriftlich oder zu Protokoll der Geschäftsstelle Einspruch eingelegt werden.</p>
            `;
        } else {
            signerEl.textContent = 'Präsident/in des Amtsgerichts Tiergarten (Schöffengeschäftsstelle)';
            bodyEl.innerHTML = `
                <p>Sehr geehrte(r) <strong>${escapeHtml(akte.vorname)} ${escapeHtml(akte.nachname)}</strong>,</p>
                <p>auf Grundlage Ihrer Bewerbung / der Vorschlagsliste werden Sie hiermit gemäß § 45 GVG zum ehrenamtlichen Schöffendienst am Amtsgericht Tiergarten berufen.</p>
                <p><strong>Hinweis:</strong> Das Schöffenamt ist ein Ehrenamt. Die genaue Terminladung zu den Hauptverhandlungen erfolgt gesondert durch die jeweilige Strafkammer.</p>
            `;
        }

        window.print();
    });

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
