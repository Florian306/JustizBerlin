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
            renderGesetzeIntern();
        }
        if (tabId === 'gesetze') {
            renderGesetzePublic();
        }
    }

    navTabs.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Sub-Navigation im Internen Dienstportal
    document.querySelectorAll('.sub-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.subtab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`subtab-${btn.dataset.subtab}`).classList.add('active');
        });
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
    renderNewBookNotice();

    async function renderNewBookNotice() {
        const data = await GesetzeAPI.getAll();
        const noticeEl = document.getElementById('new-book-notice');
        const customBooks = data.books.filter(b => b.createdAt);
        if (customBooks.length === 0) {
            noticeEl.classList.add('hidden');
            return;
        }
        const latest = customBooks[customBooks.length - 1];
        noticeEl.innerHTML = `<strong>Neue Gesetzesveröffentlichung (${escapeHtml(latest.createdAt)}):</strong> Das Gesetzbuch <strong>${escapeHtml(latest.title)}</strong> wurde neu in die Berliner Gesetzessammlung aufgenommen. <a href="#gesetze" id="notice-goto-gesetze">Zur Gesetzessammlung</a>`;
        noticeEl.classList.remove('hidden');

        document.getElementById('notice-goto-gesetze').addEventListener('click', (e) => {
            e.preventDefault();
            selectedPublicBookId = latest.id;
            switchTab('gesetze');
        });
    }

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

    // --- TAB 2: Online-Antrag einreichen (Intelligentes Formular & Beweismittel) ---
    const antragForm = document.getElementById('antrag-form');
    const antragTypSelect = document.getElementById('antrag-typ');
    const extraFieldsContainer = document.getElementById('extra-fields-container');
    const beweismittelInput = document.getElementById('beweismittel-input');
    const beweismittelListEl = document.getElementById('beweismittel-list');
    const confBox = document.getElementById('antrag-bestaetigung');

    let currentBeweismittel = [];

    function updateDynamicFormFields() {
        const typ = antragTypSelect.value;
        const lblBehoerde = document.getElementById('lbl-behoerde');
        const lblBeteiligter = document.getElementById('lbl-beteiligter');
        const rowBeteiligter = document.getElementById('row-beteiligter');
        const lblSachverhalt = document.getElementById('lbl-sachverhalt');

        extraFieldsContainer.innerHTML = '';
        extraFieldsContainer.classList.add('hidden');
        rowBeteiligter.classList.remove('hidden');

        if (typ.includes('Strafanzeige')) {
            lblBehoerde.textContent = 'Dienststelle / Anschrift';
            lblBeteiligter.textContent = 'Tatverdächtige/r / Beschuldigte/r';
            lblSachverhalt.innerHTML = 'Tathergang / Ermittlungsergebnis <span class="req">*</span>';
            extraFieldsContainer.innerHTML = `
                <div class="form-grid-2">
                    <div class="form-row">
                        <label for="extra-tatort">Tatort</label>
                        <input type="text" id="extra-tatort" placeholder="z. B. Kurfürstendamm 45">
                    </div>
                    <div class="form-row">
                        <label for="extra-tatzeit">Tatzeit</label>
                        <input type="text" id="extra-tatzeit" placeholder="z. B. 16.11.2026, ca. 02:30 Uhr">
                    </div>
                </div>
            `;
            extraFieldsContainer.classList.remove('hidden');
        } else if (typ.includes('Haftbefehl')) {
            lblBehoerde.textContent = 'Antragstellende Dienststelle / StA';
            lblBeteiligter.textContent = 'Zielperson / Beschuldigte/r';
            lblSachverhalt.innerHTML = 'Dringender Tatverdacht &amp; Begründung <span class="req">*</span>';
            extraFieldsContainer.innerHTML = `
                <div class="form-row">
                    <label for="extra-haftgrund">Haftgrund / Dringlichkeit</label>
                    <input type="text" id="extra-haftgrund" placeholder="z. B. Fluchtgefahr (§ 112 StPO) / Eilantrag">
                </div>
            `;
            extraFieldsContainer.classList.remove('hidden');
        } else if (typ.includes('Schlichtung')) {
            lblBehoerde.textContent = 'Wohnanschrift';
            lblBeteiligter.textContent = 'Antragsgegner / Unternehmen';
            lblSachverhalt.innerHTML = 'Streitgegenstand / Beschwerde <span class="req">*</span>';
            extraFieldsContainer.innerHTML = `
                <div class="form-row">
                    <label for="extra-streitwert">Streitwert / Forderung (in EUR)</label>
                    <input type="text" id="extra-streitwert" placeholder="z. B. 2.500 EUR">
                </div>
            `;
            extraFieldsContainer.classList.remove('hidden');
        } else if (typ.includes('Schöffe')) {
            lblBehoerde.textContent = 'Meldeanschrift in Berlin';
            rowBeteiligter.classList.add('hidden');
            lblSachverhalt.innerHTML = 'Motivation &amp; Eignung <span class="req">*</span>';
            extraFieldsContainer.innerHTML = `
                <div class="form-grid-2">
                    <div class="form-row">
                        <label for="extra-geburtsdatum">Geburtsdatum</label>
                        <input type="text" id="extra-geburtsdatum" placeholder="z. B. 12.04.1992">
                    </div>
                    <div class="form-row">
                        <label for="extra-beruf">Beruf / Tätigkeit</label>
                        <input type="text" id="extra-beruf" placeholder="z. B. Kaufmann / Angestellte">
                    </div>
                </div>
            `;
            extraFieldsContainer.classList.remove('hidden');
        }
    }

    antragTypSelect.addEventListener('change', updateDynamicFormFields);

    function renderBeweismittelList() {
        if (currentBeweismittel.length === 0) {
            beweismittelListEl.innerHTML = '';
            return;
        }
        const table = document.createElement('table');
        table.className = 'compact-table';
        table.innerHTML = '<tbody></tbody>';
        const tbody = table.querySelector('tbody');

        currentBeweismittel.forEach((bwm, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="mono-bold" style="width: 120px;">${escapeHtml(bwm.kennung)}</td>
                <td>${escapeHtml(bwm.name)} <small>(${escapeHtml(bwm.size)})</small></td>
                <td style="width: 80px; text-align: right;"><button type="button" class="btn-secondary btn-small btn-rem-bwm" data-idx="${idx}">Entfernen</button></td>
            `;
            tbody.appendChild(tr);
        });

        beweismittelListEl.innerHTML = '';
        beweismittelListEl.appendChild(table);

        beweismittelListEl.querySelectorAll('.btn-rem-bwm').forEach(btn => {
            btn.addEventListener('click', () => {
                currentBeweismittel.splice(Number(btn.dataset.idx), 1);
                renderBeweismittelList();
            });
        });
    }

    beweismittelInput.addEventListener('change', () => {
        const files = Array.from(beweismittelInput.files || []);
        files.forEach(file => {
            const num = Math.floor(100 + Math.random() * 899);
            const kennung = `BWM-26-${num}`;
            const sizeKb = Math.max(1, Math.round(file.size / 1024));
            currentBeweismittel.push({
                kennung,
                name: file.name,
                type: file.type || 'Datei',
                size: `${sizeKb} KB`
            });
        });
        beweismittelInput.value = '';
        renderBeweismittelList();
    });

    antragForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const typ = antragTypSelect.value;
        const vorname = document.getElementById('antrag-vorname').value.trim();
        const nachname = document.getElementById('antrag-nachname').value.trim();
        const behoerde = document.getElementById('antrag-behoerde').value.trim() || 'Keine Angabe';
        const beteiligter = document.getElementById('antrag-beteiligter').value.trim() || 'Keine Angabe';
        let sachverhalt = document.getElementById('antrag-sachverhalt').value.trim();

        // Zusatzfelder an Sachverhalt anhängen
        const extras = [];
        extraFieldsContainer.querySelectorAll('input').forEach(inp => {
            if (inp.value.trim()) {
                const label = extraFieldsContainer.querySelector(`label[for="${inp.id}"]`)?.textContent || inp.id;
                extras.push(`${label}: ${inp.value.trim()}`);
            }
        });
        if (extras.length > 0) {
            sachverhalt = `${extras.join(' | ')}\n\n${sachverhalt}`;
        }

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
            vermerk: 'Elektronisch über Bürger-/Polizei-Service eingereicht.',
            beweismittel: [...currentBeweismittel]
        };

        await AktenAPI.create(neueAkte);

        document.getElementById('conf-az').textContent = az;
        document.getElementById('conf-name').textContent = `${vorname} ${nachname}`;
        document.getElementById('conf-typ').textContent = typ;
        document.getElementById('conf-datum').textContent = heute;
        document.getElementById('conf-beweismittel').textContent = currentBeweismittel.length > 0
            ? currentBeweismittel.map(b => `${b.kennung} (${b.name})`).join(', ')
            : 'Keine';

        confBox.classList.remove('hidden');
        antragForm.reset();
        currentBeweismittel = [];
        renderBeweismittelList();
        updateDynamicFormFields();
        updateStats();
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

        let bwmList = [];
        try {
            bwmList = typeof akte.beweismittel === 'string'
                ? JSON.parse(akte.beweismittel)
                : (akte.beweismittel || []);
        } catch {
            bwmList = [];
        }
        const bwmEl = document.getElementById('detail-beweismittel');
        if (bwmList.length === 0) {
            bwmEl.textContent = 'Keine Beweismittel beigefügt.';
        } else {
            bwmEl.innerHTML = bwmList.map(b =>
                `<div><span class="mono-bold">${escapeHtml(b.kennung)}</span> – ${escapeHtml(b.name)} (${escapeHtml(b.size || '')})</div>`
            ).join('');
        }
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

    // --- Gesetzessammlung (Öffentlich & Intern) ---
    const gesetzeFilterBook = document.getElementById('gesetze-filter-book');
    const gesetzeFilterSearch = document.getElementById('gesetze-filter-search');
    let selectedPublicBookId = null;

    gesetzeFilterBook.addEventListener('change', () => {
        selectedPublicBookId = gesetzeFilterBook.value === 'alle' ? null : gesetzeFilterBook.value;
        renderGesetzePublic();
    });
    gesetzeFilterSearch.addEventListener('input', renderGesetzePublic);

    async function renderGesetzePublic() {
        const data = await GesetzeAPI.getAll();
        const search = gesetzeFilterSearch.value.trim().toLowerCase();

        // Dropdown aktualisieren
        gesetzeFilterBook.innerHTML = '<option value="alle">Alle Gesetzbücher (Übersicht)</option>';
        data.books.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.title;
            if (b.id === selectedPublicBookId) opt.selected = true;
            gesetzeFilterBook.appendChild(opt);
        });

        const container = document.getElementById('gesetze-public-list');
        container.innerHTML = '';

        // Ansicht 1: Bücher-Übersicht (wenn kein Buch ausgewählt und keine Suche aktiv)
        if (!selectedPublicBookId && !search) {
            const grid = document.createElement('div');
            grid.className = 'service-cards-grid';

            data.books.forEach(book => {
                const count = data.laws.filter(l => l.bookId === book.id).length;
                const card = document.createElement('div');
                card.className = 'service-card book-card';
                card.innerHTML = `
                    <div>
                        <span class="hero-kicker">${escapeHtml(book.short)}</span>
                        <h4>${escapeHtml(book.title)}</h4>
                        <p>${count} ${count === 1 ? 'Vorschrift' : 'Vorschriften'} hinterlegt</p>
                    </div>
                    <button type="button" class="btn-secondary btn-small btn-open-book" data-book-id="${escapeHtml(book.id)}">Gesetzbuch öffnen</button>
                `;
                grid.appendChild(card);
            });

            container.appendChild(grid);

            container.querySelectorAll('.btn-open-book').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedPublicBookId = btn.dataset.bookId;
                    renderGesetzePublic();
                });
            });
            return;
        }

        // Ansicht 2: Einzelnes Gesetzbuch oder Suchergebnisse
        if (selectedPublicBookId) {
            const backBar = document.createElement('div');
            backBar.className = 'mb-20';
            backBar.innerHTML = `<button type="button" id="btn-back-books" class="btn-secondary btn-small">&larr; Zurück zur Übersicht aller Gesetzbücher</button>`;
            container.appendChild(backBar);

            document.getElementById('btn-back-books').addEventListener('click', () => {
                selectedPublicBookId = null;
                gesetzeFilterSearch.value = '';
                renderGesetzePublic();
            });
        }

        const booksToShow = selectedPublicBookId
            ? data.books.filter(b => b.id === selectedPublicBookId)
            : data.books;

        let anyShown = false;

        booksToShow.forEach(book => {
            const laws = data.laws.filter(l => {
                if (l.bookId !== book.id) return false;
                if (!search) return true;
                return l.paragraph.toLowerCase().includes(search) ||
                    l.title.toLowerCase().includes(search) ||
                    l.text.toLowerCase().includes(search);
            }).sort((a, b) => a.paragraph.localeCompare(b.paragraph, 'de', { numeric: true }));

            if (laws.length === 0) return;
            anyShown = true;

            const section = document.createElement('div');
            section.className = 'mb-20';
            section.innerHTML = `<h3 class="section-heading">${escapeHtml(book.title)}</h3>`;

            const table = document.createElement('table');
            table.className = 'official-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th style="width: 90px;">Paragraph</th>
                        <th style="width: 220px;">Titel</th>
                        <th>Wortlaut</th>
                        <th style="width: 120px;">Stand</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;

            const tbody = table.querySelector('tbody');
            laws.forEach(law => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="mono-bold">${escapeHtml(law.paragraph)}</td>
                    <td><strong>${escapeHtml(law.title)}</strong></td>
                    <td>${escapeHtml(law.text)}</td>
                    <td>${escapeHtml(law.updatedAt || 'Initial')}</td>
                `;
                tbody.appendChild(tr);
            });

            section.appendChild(table);
            container.appendChild(section);
        });

        if (!anyShown) {
            const emptyBox = document.createElement('div');
            emptyBox.className = 'notice-box mt-10';
            emptyBox.textContent = 'Keine passenden Vorschriften in diesem Gesetzbuch gefunden.';
            container.appendChild(emptyBox);
        }
    }

    const adminLawsFilter = document.getElementById('admin-laws-filter-book');
    adminLawsFilter.addEventListener('change', renderGesetzeIntern);

    async function renderGesetzeIntern() {
        const data = await GesetzeAPI.getAll();
        const bookSelect = document.getElementById('law-book-select');
        const currentVal = bookSelect.value;

        bookSelect.innerHTML = '';
        if (data.books.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '-- Bitte zuerst Gesetzbuch anlegen --';
            bookSelect.appendChild(opt);
        } else {
            data.books.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = b.title;
                if (b.id === currentVal) opt.selected = true;
                bookSelect.appendChild(opt);
            });
        }

        // Filter-Dropdown über Verwaltungstabelle aktualisieren
        const currentFilter = adminLawsFilter.value;
        adminLawsFilter.innerHTML = '<option value="alle">Alle Gesetzbücher</option>';
        data.books.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.title;
            if (b.id === currentFilter) opt.selected = true;
            adminLawsFilter.appendChild(opt);
        });

        // Angelegte Gesetzbücher-Liste rendern
        const booksListEl = document.getElementById('admin-books-list');
        if (data.books.length === 0) {
            booksListEl.innerHTML = '<p class="demo-hint">Noch keine Gesetzbücher angelegt.</p>';
        } else {
            booksListEl.innerHTML = '';
            data.books.forEach(b => {
                const row = document.createElement('div');
                row.className = 'detail-header-row';
                row.style.padding = '5px 0';
                row.style.borderBottom = '1px solid #E5E5E5';
                row.innerHTML = `
                    <span><strong>${escapeHtml(b.short)}</strong> – ${escapeHtml(b.title)}</span>
                    <button type="button" class="btn-secondary btn-small btn-del-book" data-book-id="${escapeHtml(b.id)}">Löschen</button>
                `;
                booksListEl.appendChild(row);
            });

            booksListEl.querySelectorAll('.btn-del-book').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Gesetzbuch und alle darin enthaltenen Paragraphen wirklich löschen?')) return;
                    await GesetzeAPI.deleteBook(btn.dataset.bookId);
                    renderGesetzeIntern();
                    renderGesetzePublic();
                    renderNewBookNotice();
                });
            });
        }

        const tbody = document.getElementById('intern-laws-tbody');
        tbody.innerHTML = '';

        const filteredLaws = (currentFilter === 'alle'
            ? [...data.laws]
            : data.laws.filter(l => l.bookId === currentFilter)
        ).sort((a, b) => a.paragraph.localeCompare(b.paragraph, 'de', { numeric: true }));

        if (filteredLaws.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">Noch keine Vorschriften vorhanden.</td></tr>';
            return;
        }

        filteredLaws.forEach(law => {
            const book = data.books.find(b => b.id === law.bookId);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(book ? book.short : law.bookId)}</td>
                <td class="mono-bold">${escapeHtml(law.paragraph)}</td>
                <td>${escapeHtml(law.title)}</td>
                <td>${escapeHtml(law.updatedAt || 'Initial')}</td>
                <td>
                    <button type="button" class="btn-secondary btn-small btn-edit-law" data-id="${law.id}">Bearbeiten</button>
                    <button type="button" class="btn-secondary btn-small btn-del-law" data-id="${law.id}">Löschen</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-edit-law').forEach(btn => {
            btn.addEventListener('click', () => {
                const law = data.laws.find(l => l.id === Number(btn.dataset.id));
                if (!law) return;
                document.getElementById('edit-law-id').value = law.id;
                document.getElementById('edit-law-paragraph').value = law.paragraph;
                document.getElementById('edit-law-title').value = law.title;
                document.getElementById('edit-law-text').value = law.text;
                const panel = document.getElementById('edit-law-panel');
                panel.classList.remove('hidden');
                panel.scrollIntoView({ behavior: 'smooth' });
            });
        });

        document.querySelectorAll('.btn-del-law').forEach(btn => {
            btn.addEventListener('click', async () => {
                await GesetzeAPI.deleteLaw(Number(btn.dataset.id));
                renderGesetzeIntern();
                renderGesetzePublic();
            });
        });
    }

    document.getElementById('btn-cancel-edit-law').addEventListener('click', () => {
        document.getElementById('edit-law-panel').classList.add('hidden');
    });

    document.getElementById('form-edit-law').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = Number(document.getElementById('edit-law-id').value);
        const paragraph = document.getElementById('edit-law-paragraph').value.trim();
        const title = document.getElementById('edit-law-title').value.trim();
        const text = document.getElementById('edit-law-text').value.trim();
        if (!id || !paragraph || !title || !text) return;

        await GesetzeAPI.updateLaw(id, { paragraph, title, text });
        document.getElementById('edit-law-panel').classList.add('hidden');
        renderGesetzeIntern();
        renderGesetzePublic();
    });

    document.getElementById('form-add-book').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('book-title').value.trim();
        const short = document.getElementById('book-short').value.trim();
        if (!title || !short) return;

        await GesetzeAPI.addBook(title, short);
        e.target.reset();
        document.getElementById('book-save-msg').classList.remove('hidden');
        renderGesetzeIntern();
        renderGesetzePublic();
        renderNewBookNotice();
    });

    document.getElementById('form-add-law').addEventListener('submit', async (e) => {
        e.preventDefault();
        const bookId = document.getElementById('law-book-select').value;
        const customParagraph = document.getElementById('law-paragraph').value.trim();
        const title = document.getElementById('law-title').value.trim();
        const text = document.getElementById('law-text').value.trim();
        if (!bookId || !title || !text) return;

        await GesetzeAPI.addLaw(bookId, title, text, customParagraph);
        document.getElementById('law-paragraph').value = '';
        document.getElementById('law-title').value = '';
        document.getElementById('law-text').value = '';
        document.getElementById('law-save-msg').classList.remove('hidden');
        renderGesetzeIntern();
        renderGesetzePublic();
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
