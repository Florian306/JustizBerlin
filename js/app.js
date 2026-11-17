document.addEventListener('DOMContentLoaded', () => {
    let currentSelectedAz = null;
    let isLoggedIn = false;

    // --- Tab-Navigation (mit Zustandserhalt über Reload) ---
    const navTabs = document.querySelectorAll('.nav-tab');
    const tabPanels = document.querySelectorAll('.tab-panel');

    function syncUrlHash(tabId) {
        let hash = `#${tabId}`;
        if (tabId === 'gesetze' && selectedPublicBookId) {
            hash += `/${encodeURIComponent(selectedPublicBookId)}`;
            if (selectedPublicLawId) {
                hash += `/${selectedPublicLawId}`;
            }
        }
        if (window.location.hash !== hash) {
            history.replaceState(null, '', hash);
        }
    }

    function switchTab(tabId) {
        sessionStorage.setItem('justiz_active_tab', tabId);
        syncUrlHash(tabId);
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
            sessionStorage.setItem('justiz_active_subtab', btn.dataset.subtab);
            document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.subtab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`subtab-${btn.dataset.subtab}`).classList.add('active');
            if (btn.dataset.subtab === 'gesetze-admin') {
                renderGesetzeIntern();
            } else if (btn.dataset.subtab === 'logs') {
                renderLogsIntern();
            } else if (btn.dataset.subtab === 'roles') {
                renderRolesIntern();
                renderBansIntern();
            }
        });
    });

    // Akten-Reiter (Tabs innerhalb der Aktenbearbeitung)
    document.querySelectorAll('.akte-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.akte-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.aktetab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`aktetab-${btn.dataset.aktetab}`).classList.add('active');
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

    async function renderBekanntmachungen() {
        const tbody = document.getElementById('bekanntmachungen-tbody');
        const [akten, gesetze] = await Promise.all([AktenAPI.getAll(), GesetzeAPI.getAll()]);

        const items = [];

        // Echte veröffentlichte Gesetzbücher
        gesetze.books.filter(b => b.createdAt).forEach(b => {
            items.push({
                datum: b.createdAt,
                betreff: `<strong>Gesetzbuch veröffentlicht:</strong> ${escapeHtml(b.title)}`,
                az: b.short,
                detailTitle: `Veröffentlichung: ${b.title} (${b.short})`,
                detailText: `Das Gesetzbuch "${b.title}" wurde am ${b.createdAt} in die Berliner Gesetzessammlung aufgenommen.`
            });
        });

        // Echte erlassene Beschlüsse & Anklagen
        akten.filter(a => a.status === 'Beschluss erlassen' || a.status === 'Anklage erhoben').forEach(a => {
            items.push({
                datum: a.datum,
                betreff: `<strong>${escapeHtml(a.status)}:</strong> ${escapeHtml(a.typ)}`,
                az: a.az,
                detailTitle: `${a.status} – Az. ${a.az}`,
                detailText: `Im Verfahren ${a.az} (${a.typ}) wurde der Status "${a.status}" vermerkt.`
            });
        });

        tbody.innerHTML = '';
        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3">Aktuell liegen keine amtlichen Bekanntmachungen vor.</td></tr>';
            return;
        }

        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(item.datum)}</td>
                <td>${item.betreff}</td>
                <td class="mono-bold">${escapeHtml(item.az)}</td>
            `;
            tr.addEventListener('click', () => {
                document.getElementById('bekanntmachung-detail-title').textContent = item.detailTitle;
                document.getElementById('bekanntmachung-detail-text').textContent = item.detailText;
                document.getElementById('bekanntmachung-detail').classList.remove('hidden');
            });
            tbody.appendChild(tr);
        });
    }

    renderBekanntmachungen();

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
        const wrapper = document.getElementById('antrag-fields-wrapper');
        if (!typ) {
            wrapper.classList.add('hidden');
            return;
        }
        wrapper.classList.remove('hidden');

        const lblBehoerde = document.getElementById('lbl-behoerde');
        const inpBehoerde = document.getElementById('antrag-behoerde');
        const lblBeteiligter = document.getElementById('lbl-beteiligter');
        const inpBeteiligter = document.getElementById('antrag-beteiligter');
        const rowBeteiligter = document.getElementById('row-beteiligter');
        const lblSachverhalt = document.getElementById('lbl-sachverhalt');
        const inpSachverhalt = document.getElementById('antrag-sachverhalt');
        const lblWahrheit = document.getElementById('lbl-wahrheit-text');

        extraFieldsContainer.innerHTML = '';
        extraFieldsContainer.classList.add('hidden');
        rowBeteiligter.classList.remove('hidden');

        // Standard-Texte zurücksetzen
        lblWahrheit.textContent = 'Ich versichere, sämtliche Angaben nach bestem Wissen und Gewissen wahrheitsgemäß gemacht zu haben (Hinweis auf § 164 StGB – Falsche Verdächtigung).';

        if (typ.includes('Strafanzeige')) {
            lblBehoerde.textContent = 'Dienststelle / Anschrift';
            inpBehoerde.placeholder = 'z. B. Polizei Berlin LKA 41 oder Wohnanschrift';
            lblBeteiligter.textContent = 'Tatverdächtige/r / Beschuldigte/r';
            inpBeteiligter.placeholder = 'Name des Beschuldigten (falls bekannt)';
            lblSachverhalt.innerHTML = 'Tathergang / Ermittlungsergebnis <span class="req">*</span>';
            inpSachverhalt.placeholder = 'Schildern Sie den Tathergang sachlich und vollständig (Ort, Zeit, Tatvorwurf)...';
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
            inpBehoerde.placeholder = 'z. B. Polizei Berlin LKA 41 / StA Berlin';
            lblBeteiligter.textContent = 'Zielperson / Beschuldigte/r';
            inpBeteiligter.placeholder = 'Name und Geburtsdatum der Zielperson';
            lblSachverhalt.innerHTML = 'Dringender Tatverdacht &amp; Begründung <span class="req">*</span>';
            inpSachverhalt.placeholder = 'Begründen Sie den dringenden Tatverdacht und die beantragte Maßnahme...';
            extraFieldsContainer.innerHTML = `
                <div class="form-row">
                    <label for="extra-haftgrund">Haftgrund / Dringlichkeit</label>
                    <input type="text" id="extra-haftgrund" placeholder="z. B. Fluchtgefahr (§ 112 StPO) / Eilantrag">
                </div>
            `;
            extraFieldsContainer.classList.remove('hidden');
        } else if (typ.includes('Schlichtung')) {
            lblBehoerde.textContent = 'Wohnanschrift';
            inpBehoerde.placeholder = 'z. B. Musterstraße 12, 10115 Berlin';
            lblBeteiligter.textContent = 'Antragsgegner / Unternehmen';
            inpBeteiligter.placeholder = 'Name des Antragsgegners oder Unternehmens';
            lblSachverhalt.innerHTML = 'Streitgegenstand / Beschwerde <span class="req">*</span>';
            inpSachverhalt.placeholder = 'Schildern Sie den Streitgegenstand und Ihre Forderung...';
            extraFieldsContainer.innerHTML = `
                <div class="form-row">
                    <label for="extra-streitwert">Streitwert / Forderung (in EUR)</label>
                    <input type="text" id="extra-streitwert" placeholder="z. B. 2.500 EUR">
                </div>
            `;
            extraFieldsContainer.classList.remove('hidden');
        } else if (typ.includes('Schöffe')) {
            lblBehoerde.textContent = 'Meldeanschrift in Berlin';
            inpBehoerde.placeholder = 'z. B. Musterstraße 12, 10115 Berlin';
            rowBeteiligter.classList.add('hidden');
            lblSachverhalt.innerHTML = 'Motivation &amp; Eignung <span class="req">*</span>';
            inpSachverhalt.placeholder = 'Warum möchten Sie das Schöffenamt ausüben? Kurze Darstellung Ihrer Eignung...';
            lblWahrheit.textContent = 'Ich versichere, dass keine Vorstrafen vorliegen und alle Angaben wahrheitsgemäß sind.';
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
        } else if (typ.includes('Akteneinsicht')) {
            lblBehoerde.textContent = 'Kanzlei / Anschrift';
            inpBehoerde.placeholder = 'z. B. Kanzlei Dr. Baumann, Kurfürstendamm 12';
            lblBeteiligter.textContent = 'Mandant / Beschuldigte/r';
            inpBeteiligter.placeholder = 'Name des vertretenen Mandanten';
            lblSachverhalt.innerHTML = 'Begründung / Umfang der Akteneinsicht <span class="req">*</span>';
            inpSachverhalt.placeholder = 'Beantragt wird vollständige Akteneinsicht gemäß § 147 StPO...';
            lblWahrheit.textContent = 'Ich versichere, dass eine ordnungsgemäße Verteidigungsvollmacht vorliegt und alle Angaben wahrheitsgemäß sind.';
            extraFieldsContainer.innerHTML = `
                <div class="form-row">
                    <label for="extra-az">Bestehendes Aktenzeichen (falls vorhanden)</label>
                    <input type="text" id="extra-az" placeholder="z. B. 204/26 StA">
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

    function getTimestampDE() {
        return new Date().toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) + ' Uhr';
    }

    function readFileAsEvidence(file) {
        return new Promise((resolve) => {
            const num = Math.floor(100 + Math.random() * 899);
            const kennung = `BWM-26-${num}`;
            const sizeKb = Math.max(1, Math.round(file.size / 1024));
            const base = {
                kennung,
                name: file.name,
                type: file.type || 'application/octet-stream',
                size: `${sizeKb} KB`,
                addedAt: getTimestampDE(),
                dataUrl: null
            };
            if (file.size <= 10 * 1024 * 1024) {
                const reader = new FileReader();
                reader.onload = () => {
                    base.dataUrl = reader.result;
                    resolve(base);
                };
                reader.onerror = () => resolve(base);
                reader.readAsDataURL(file);
            } else {
                resolve(base);
            }
        });
    }

    beweismittelInput.addEventListener('change', async () => {
        const files = Array.from(beweismittelInput.files || []);
        for (const file of files) {
            const bwm = await readFileAsEvidence(file);
            currentBeweismittel.push(bwm);
        }
        beweismittelInput.value = '';
        renderBeweismittelList();
    });

    document.getElementById('btn-add-bwm-link').addEventListener('click', () => {
        const url = document.getElementById('bwm-link-url').value.trim();
        const title = document.getElementById('bwm-link-title').value.trim();
        if (!url) return;
        const num = Math.floor(100 + Math.random() * 899);
        currentBeweismittel.push({
            kennung: `BWM-26-${num}`,
            name: title || url,
            externalUrl: url,
            type: 'link',
            size: 'Externer Link',
            addedAt: getTimestampDE(),
            dataUrl: null
        });
        document.getElementById('bwm-link-url').value = '';
        document.getElementById('bwm-link-title').value = '';
        renderBeweismittelList();
    });

    antragForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // Falls noch ein Link im Feld steht, automatisch übernehmen
        const pendingUrl = document.getElementById('bwm-link-url').value.trim();
        if (pendingUrl) {
            document.getElementById('btn-add-bwm-link').click();
        }
        const typ = antragTypSelect.value;
        const vorname = document.getElementById('antrag-vorname').value.trim();
        const nachname = document.getElementById('antrag-nachname').value.trim();
        const kontakt = document.getElementById('antrag-kontakt').value.trim();
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
            kontakt,
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

    document.getElementById('btn-print-confirmation').addEventListener('click', () => {
        const az = document.getElementById('conf-az').textContent;
        const name = document.getElementById('conf-name').textContent;
        const typ = document.getElementById('conf-typ').textContent;
        const datum = document.getElementById('conf-datum').textContent;
        const bwm = document.getElementById('conf-beweismittel').textContent;

        document.getElementById('print-az').textContent = az;
        document.getElementById('print-datum').textContent = datum;
        document.getElementById('print-doc-title').textContent = 'AMTLICHE EINGANGSBESTÄTIGUNG';
        document.getElementById('print-signer').textContent = 'Elektronische Poststelle – Senatsverwaltung für Justiz und Verbraucherschutz';
        document.getElementById('print-doc-body').innerHTML = `
            <p>Hiermit wird der elektronische Eingang Ihres Vorgangs bei der Senatsverwaltung für Justiz und Verbraucherschutz – Land Berlin bestätigt.</p>
            <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
                <tr><th style="text-align:left; padding:8px; border:1px solid #999; background:#F2F2F2; width:35%;">Aktenzeichen:</th><td style="padding:8px; border:1px solid #999;"><strong>${escapeHtml(az)}</strong></td></tr>
                <tr><th style="text-align:left; padding:8px; border:1px solid #999; background:#F2F2F2;">Antragsteller/in:</th><td style="padding:8px; border:1px solid #999;">${escapeHtml(name)}</td></tr>
                <tr><th style="text-align:left; padding:8px; border:1px solid #999; background:#F2F2F2;">Vorgangsart:</th><td style="padding:8px; border:1px solid #999;">${escapeHtml(typ)}</td></tr>
                <tr><th style="text-align:left; padding:8px; border:1px solid #999; background:#F2F2F2;">Eingangsdatum:</th><td style="padding:8px; border:1px solid #999;">${escapeHtml(datum)}</td></tr>
                <tr><th style="text-align:left; padding:8px; border:1px solid #999; background:#F2F2F2;">Beweismittel:</th><td style="padding:8px; border:1px solid #999;">${escapeHtml(bwm)}</td></tr>
            </table>
            <p>Bitte bewahren Sie das Aktenzeichen <strong>${escapeHtml(az)}</strong> für Rückfragen unter „Vorgangs- &amp; Aktenauskunft“ auf.</p>
        `;
        window.print();
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

        renderAuskunftDetail(treffer);
    });

    function renderAuskunftDetail(treffer) {
        let bwmList = [];
        try {
            bwmList = typeof treffer.beweismittel === 'string'
                ? JSON.parse(treffer.beweismittel)
                : (treffer.beweismittel || []);
        } catch { bwmList = []; }

        let nachtraegeList = [];
        try {
            nachtraegeList = typeof treffer.nachtraege === 'string'
                ? JSON.parse(treffer.nachtraege)
                : (treffer.nachtraege || []);
        } catch { nachtraegeList = []; }

        const bwmHtml = bwmList.length === 0
            ? 'Keine Beweismittel hinterlegt.'
            : bwmList.map((b, idx) => `
                <div class="detail-header-row" style="padding: 4px 0; border-bottom: 1px solid #E5E5E5;">
                    <span><span class="mono-bold">${escapeHtml(b.kennung)}</span> – ${escapeHtml(b.name)} (${escapeHtml(b.size || '')})</span>
                    <button type="button" class="btn-secondary btn-small btn-auskunft-view-bwm" data-idx="${idx}">Ansehen</button>
                </div>
            `).join('');

        const nachtraegeHtml = nachtraegeList.length === 0
            ? 'Keine Nachträge vorhanden.'
            : nachtraegeList.map(n =>
                `<div style="padding: 6px 0; border-bottom: 1px solid #E5E5E5;"><strong>${escapeHtml(n.timestamp)}</strong> (${escapeHtml(n.author)}):<br>${escapeHtml(n.text)}</div>`
            ).join('');

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

            <hr class="divider">
            <p><strong>Eingereichte Beweismittel:</strong></p>
            <div class="sachverhalt-box">${bwmHtml}</div>
            <div id="auskunft-bwm-preview" class="sachverhalt-box mt-10 hidden"></div>

            <p class="mt-10"><strong>Chronologie / Nachträge:</strong></p>
            <div class="sachverhalt-box">${nachtraegeHtml}</div>

            <form id="form-auskunft-nachtrag" class="official-form mt-20">
                <h4 class="box-title">Weitere Aussage oder Beweismittel nachreichen</h4>
                <div class="form-row">
                    <label for="auskunft-nachtrag-text">Ergänzende Erklärung / Aussage</label>
                    <textarea id="auskunft-nachtrag-text" rows="2" placeholder="Schildern Sie Ihre Ergänzung zum Vorgang..."></textarea>
                </div>
                <div class="form-row">
                    <label for="auskunft-nachtrag-files">Weitere Beweismittel anhängen (PDF, Bilder, Videos, Audio)</label>
                    <input type="file" id="auskunft-nachtrag-files" multiple accept=".pdf,image/*,video/*,audio/*">
                </div>
                <button type="submit" class="btn-primary">Mit Zeitstempel nachreichen</button>
            </form>
        `;

        auskunftErgebnis.querySelectorAll('.btn-auskunft-view-bwm').forEach(btn => {
            btn.addEventListener('click', () => {
                const b = bwmList[Number(btn.dataset.idx)];
                const previewBox = document.getElementById('auskunft-bwm-preview');
                if (!b || !b.dataUrl) {
                    previewBox.classList.remove('hidden');
                    previewBox.textContent = 'Für diese Datei liegt keine direkte Browser-Vorschau vor.';
                    return;
                }
                previewBox.classList.remove('hidden');
                const header = `<div class="detail-header-row" style="margin-bottom:8px;"><strong>Vorschau: ${escapeHtml(b.kennung)} – ${escapeHtml(b.name)}</strong><button type="button" id="btn-close-auskunft-preview" class="btn-secondary btn-small">Schließen</button></div>`;
                let media = '';
                if ((b.type || '').startsWith('image/')) {
                    media = `<img src="${b.dataUrl}" alt="${escapeHtml(b.name)}" style="max-width:100%; max-height:400px; border:1px solid #CCC;">`;
                } else if (b.type === 'application/pdf' || b.name.toLowerCase().endsWith('.pdf')) {
                    media = `<iframe src="${b.dataUrl}" style="width:100%; height:420px; border:1px solid #CCC;"></iframe>`;
                } else if ((b.type || '').startsWith('video/')) {
                    media = `<video src="${b.dataUrl}" controls style="max-width:100%; max-height:360px;"></video>`;
                } else if ((b.type || '').startsWith('audio/')) {
                    media = `<audio src="${b.dataUrl}" controls style="width:100%;"></audio>`;
                } else {
                    media = `<a href="${b.dataUrl}" download="${escapeHtml(b.name)}" class="btn-secondary btn-small">Datei herunterladen</a>`;
                }
                previewBox.innerHTML = header + media;
                document.getElementById('btn-close-auskunft-preview').addEventListener('click', () => {
                    previewBox.classList.add('hidden');
                    previewBox.innerHTML = '';
                });
            });
        });

        document.getElementById('form-auskunft-nachtrag').addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const text = document.getElementById('auskunft-nachtrag-text').value.trim();
            const files = Array.from(document.getElementById('auskunft-nachtrag-files').files || []);
            if (!text && files.length === 0) return;

            const newBwms = [];
            for (const file of files) {
                const bwm = await readFileAsEvidence(file);
                bwmList.push(bwm);
                newBwms.push(bwm.kennung);
            }

            let entryText = text;
            if (newBwms.length > 0) {
                entryText = (entryText ? entryText + ' ' : '') + `[Beweismittel nachgereicht: ${newBwms.join(', ')}]`;
            }

            nachtraegeList.push({
                timestamp: getTimestampDE(),
                author: `${treffer.vorname} ${treffer.nachname} (Antragsteller/in)`,
                text: entryText
            });

            await AktenAPI.update(treffer.az, {
                beweismittel: bwmList,
                nachtraege: nachtraegeList
            });

            treffer.beweismittel = bwmList;
            treffer.nachtraege = nachtraegeList;
            renderAuskunftDetail(treffer);
        });
    }

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

    function applyLoggedInUI(user, permissions = ['akten', 'akten_edit', 'akten_delete', 'gesetze', 'logs']) {
        isLoggedIn = true;
        loginError.classList.add('hidden');
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        document.getElementById('logged-user-display').textContent = user;

        const tabAkten = document.querySelector('.sub-tab[data-subtab="akten"]');
        const tabGesetze = document.querySelector('.sub-tab[data-subtab="gesetze-admin"]');
        const tabLogs = document.querySelector('.sub-tab[data-subtab="logs"]');
        const tabRoles = document.querySelector('.sub-tab[data-subtab="roles"]');

        tabAkten.classList.toggle('hidden', !permissions.includes('akten'));
        tabGesetze.classList.toggle('hidden', !permissions.includes('gesetze'));
        tabLogs.classList.toggle('hidden', !permissions.includes('logs'));
        tabRoles.classList.toggle('hidden', !permissions.includes('roles'));

        // Feine Berechtigungen innerhalb der Aktenbearbeitung
        document.getElementById('btn-delete-akte').classList.toggle('hidden', !permissions.includes('akten_delete'));
        document.getElementById('btn-save-akte').classList.toggle('hidden', !permissions.includes('akten_edit'));
        document.getElementById('btn-print-doc').classList.toggle('hidden', !permissions.includes('akten_edit'));

        // Ersten erlaubten Sub-Tab aktivieren
        const firstAllowed = [
            permissions.includes('akten') ? tabAkten : null,
            permissions.includes('gesetze') ? tabGesetze : null,
            permissions.includes('logs') ? tabLogs : null
        ].find(Boolean);
        if (firstAllowed) firstAllowed.click();

        if (permissions.includes('akten')) renderInternTable();
        if (permissions.includes('gesetze')) renderGesetzeIntern();
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('login-user').value.trim();
        const pass = document.getElementById('login-pass').value;

        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user, pass })
            });
            if (res.ok) {
                const data = await res.json();
                sessionStorage.setItem('justiz_auth_user', data.user);
                applyLoggedInUI(data.user);
                logActivity('Anmeldung', 'Erfolgreich im Internen Dienstportal angemeldet.');
            } else {
                loginError.classList.remove('hidden');
            }
        } catch {
            loginError.classList.remove('hidden');
        }
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        isLoggedIn = false;
        currentSelectedAz = null;
        sessionStorage.removeItem('justiz_auth_user');
        try { await fetch('/api/auth', { method: 'DELETE' }); } catch {}
        document.getElementById('intern-detail-panel').classList.add('hidden');
        dashboardView.classList.add('hidden');
        loginView.classList.remove('hidden');
        loginForm.reset();
    });

    async function restoreSessionAndTab() {
        try {
            const res = await fetch('/api/auth');
            if (res.ok) {
                const data = await res.json();
                if (data.authenticated) {
                    applyLoggedInUI(data.user, data.permissions);
                }
            }
        } catch {
            const localUser = sessionStorage.getItem('justiz_auth_user');
            if (localUser) applyLoggedInUI(localUser);
        }

        const savedSubTab = sessionStorage.getItem('justiz_active_subtab');
        if (savedSubTab) {
            const subBtn = document.querySelector(`.sub-tab[data-subtab="${savedSubTab}"]`);
            if (subBtn) subBtn.click();
        }

        const rawHash = window.location.hash.replace('#', '');
        const hashParts = rawHash.split('/');
        const hashTab = hashParts[0];
        if (hashTab === 'gesetze') {
            if (hashParts[1]) selectedPublicBookId = decodeURIComponent(hashParts[1]);
            if (hashParts[2]) selectedPublicLawId = Number(hashParts[2]);
        }
        const savedTab = (hashTab && document.getElementById(`tab-${hashTab}`))
            ? hashTab
            : sessionStorage.getItem('justiz_active_tab');
        if (savedTab && document.getElementById(`tab-${savedTab}`)) {
            switchTab(savedTab);
        }
    }

    restoreSessionAndTab();

    // Cookie-Hinweis-Banner
    const cookieBanner = document.getElementById('cookie-banner');
    if (localStorage.getItem('justiz_cookie_ok') === '1') {
        cookieBanner.classList.add('hidden');
    }
    document.getElementById('btn-accept-cookies').addEventListener('click', () => {
        localStorage.setItem('justiz_cookie_ok', '1');
        cookieBanner.classList.add('hidden');
    });

    document.getElementById('filter-status').addEventListener('change', renderInternTable);
    document.getElementById('filter-search').addEventListener('input', renderInternTable);

    function getStatusBadgeHtml(status) {
        let cls = 'status-eingegangen';
        if (status === 'In staatsanwaltschaftlicher Prüfung') cls = 'status-pruefung';
        else if (status === 'Anklage erhoben') cls = 'status-anklage';
        else if (status === 'Beschluss erlassen') cls = 'status-beschluss';
        else if (status === 'Eingestellt') cls = 'status-eingestellt';
        return `<span class="status-badge ${cls}">${escapeHtml(status)}</span>`;
    }

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

        document.getElementById('intern-akten-count').textContent = `${gefiltert.length} von ${akten.length} Vorgängen`;

        tbody.innerHTML = '';

        if (gefiltert.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">Keine passenden Akten gefunden.</td></tr>';
            return;
        }

        gefiltert.forEach(akte => {
            const tr = document.createElement('tr');
            if (akte.az === currentSelectedAz) tr.classList.add('active-row');
            tr.innerHTML = `
                <td class="mono-bold">${escapeHtml(akte.az)}</td>
                <td>${escapeHtml(akte.datum)}</td>
                <td>${escapeHtml(akte.vorname)} ${escapeHtml(akte.nachname)}<br><small>${escapeHtml(akte.behoerde)}</small></td>
                <td>${escapeHtml(akte.typ)}</td>
                <td>${getStatusBadgeHtml(akte.status)}</td>
                <td><button type="button" class="btn-secondary btn-small btn-open-akte" data-az="${escapeHtml(akte.az)}">Öffnen</button></td>
            `;
            tr.addEventListener('click', (e) => {
                if (e.target.closest('.btn-open-akte')) return;
                openAkteDetail(akte.az);
            });
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
        const kontaktInfo = akte.kontakt ? ` (${akte.kontakt})` : '';
        document.getElementById('detail-name').textContent = `${akte.vorname} ${akte.nachname}${kontaktInfo}`;
        document.getElementById('detail-behoerde').textContent = akte.behoerde;
        document.getElementById('detail-beteiligter').textContent = akte.beteiligter;
        document.getElementById('detail-sachverhalt').textContent = akte.sachverhalt;
        document.getElementById('detail-bearbeiter').value = akte.bearbeiter || '';
        document.getElementById('detail-paragraphen').value = akte.paragraphen || '';

        let bwmList = [];
        try {
            bwmList = typeof akte.beweismittel === 'string'
                ? JSON.parse(akte.beweismittel)
                : (akte.beweismittel || []);
        } catch {
            bwmList = [];
        }
        const bwmEl = document.getElementById('detail-beweismittel');
        const previewBox = document.getElementById('bwm-preview-box');
        previewBox.classList.add('hidden');
        previewBox.innerHTML = '';

        if (bwmList.length === 0) {
            bwmEl.textContent = 'Keine Beweismittel beigefügt.';
        } else {
            bwmEl.innerHTML = '';
            bwmList.forEach((b, idx) => {
                const row = document.createElement('div');
                row.className = 'detail-header-row';
                row.style.padding = '4px 0';
                row.style.borderBottom = '1px solid #E5E5E5';
                const timeInfo = b.addedAt ? ` · <small>${escapeHtml(b.addedAt)}</small>` : '';
                row.innerHTML = `
                    <span><span class="mono-bold">${escapeHtml(b.kennung)}</span> – ${escapeHtml(b.name)} (${escapeHtml(b.size || '')})${timeInfo}</span>
                    <button type="button" class="btn-secondary btn-small btn-view-bwm" data-idx="${idx}">Ansehen</button>
                `;
                bwmEl.appendChild(row);
            });

            bwmEl.querySelectorAll('.btn-view-bwm').forEach(btn => {
                btn.addEventListener('click', () => {
                    const b = bwmList[Number(btn.dataset.idx)];
                    if (!b) return;
                    if (b.externalUrl) {
                        window.open(b.externalUrl, '_blank', 'noopener');
                        return;
                    }
                    previewBox.classList.remove('hidden');
                    if (!b.dataUrl) {
                        previewBox.innerHTML = `<p><strong>${escapeHtml(b.kennung)} (${escapeHtml(b.name)}):</strong> Für diese Datei ist keine direkte Browser-Vorschau gespeichert (nur bei neu hochgeladenen Dateien bis 10 MB verfügbar).</p>`;
                        return;
                    }
                    const header = `<div class="detail-header-row" style="margin-bottom:8px;"><strong>Vorschau: ${escapeHtml(b.kennung)} – ${escapeHtml(b.name)}</strong><button type="button" id="btn-close-preview" class="btn-secondary btn-small">Schließen</button></div>`;
                    let media = '';
                    if ((b.type || '').startsWith('image/')) {
                        media = `<img src="${b.dataUrl}" alt="${escapeHtml(b.name)}" style="max-width:100%; max-height:400px; border:1px solid #CCC;">`;
                    } else if (b.type === 'application/pdf' || b.name.toLowerCase().endsWith('.pdf')) {
                        media = `<iframe src="${b.dataUrl}" style="width:100%; height:420px; border:1px solid #CCC;"></iframe>`;
                    } else if ((b.type || '').startsWith('video/')) {
                        media = `<video src="${b.dataUrl}" controls style="max-width:100%; max-height:360px;"></video>`;
                    } else if ((b.type || '').startsWith('audio/')) {
                        media = `<audio src="${b.dataUrl}" controls style="width:100%;"></audio>`;
                    } else {
                        media = `<a href="${b.dataUrl}" download="${escapeHtml(b.name)}" class="btn-secondary btn-small">Datei herunterladen</a>`;
                    }
                    previewBox.innerHTML = header + media;
                    document.getElementById('btn-close-preview').addEventListener('click', () => {
                        previewBox.classList.add('hidden');
                        previewBox.innerHTML = '';
                    });
                });
            });
        }

        let nachtraegeList = [];
        try {
            nachtraegeList = typeof akte.nachtraege === 'string'
                ? JSON.parse(akte.nachtraege)
                : (akte.nachtraege || []);
        } catch {
            nachtraegeList = [];
        }
        const nachtraegeEl = document.getElementById('detail-nachtraege');
        if (nachtraegeList.length === 0) {
            nachtraegeEl.textContent = 'Keine Nachträge vorhanden.';
        } else {
            nachtraegeEl.innerHTML = nachtraegeList.map(n =>
                `<div style="padding: 6px 0; border-bottom: 1px solid #E5E5E5;"><strong>${escapeHtml(n.timestamp)}</strong> (${escapeHtml(n.author)}):<br>${escapeHtml(n.text)}</div>`
            ).join('');
        }

        document.getElementById('tab-count-bwm').textContent = `(${bwmList.length})`;
        document.getElementById('tab-count-hist').textContent = `(${nachtraegeList.length})`;
        document.getElementById('detail-status-select').value = akte.status;
        document.getElementById('detail-vermerk').value = akte.vermerk || '';
        document.getElementById('save-feedback').classList.add('hidden');

        const panel = document.getElementById('intern-detail-panel');
        panel.classList.remove('hidden');
        renderInternTable();
        panel.scrollIntoView({ behavior: 'smooth' });
    }

    document.getElementById('btn-copy-az').addEventListener('click', async () => {
        if (!currentSelectedAz) return;
        try {
            await navigator.clipboard.writeText(currentSelectedAz);
            const btn = document.getElementById('btn-copy-az');
            btn.textContent = 'Kopiert!';
            setTimeout(() => { btn.textContent = 'AZ kopieren'; }, 1500);
        } catch {}
    });

    document.getElementById('btn-close-detail').addEventListener('click', () => {
        currentSelectedAz = null;
        document.getElementById('intern-detail-panel').classList.add('hidden');
        renderInternTable();
    });

    function showConfirmModal(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            document.getElementById('confirm-modal-title').textContent = title;
            document.getElementById('confirm-modal-text').textContent = message;
            modal.classList.remove('hidden');

            const okBtn = document.getElementById('confirm-modal-ok');
            const cancelBtn = document.getElementById('confirm-modal-cancel');

            function cleanup(result) {
                modal.classList.add('hidden');
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
                resolve(result);
            }
            function onOk() { cleanup(true); }
            function onCancel() { cleanup(false); }

            okBtn.addEventListener('click', onOk);
            cancelBtn.addEventListener('click', onCancel);
        });
    }

    document.getElementById('btn-delete-akte').addEventListener('click', async () => {
        if (!currentSelectedAz) return;
        const ok = await showConfirmModal(
            'Akte unwiderruflich löschen',
            `Möchten Sie den Vorgang ${currentSelectedAz} inklusive aller Beweismittel und Nachträge wirklich unwiderruflich löschen?`
        );
        if (!ok) return;
        await AktenAPI.remove(currentSelectedAz);
        logActivity('Akte gelöscht', `Vorgang ${currentSelectedAz} wurde gelöscht.`);
        currentSelectedAz = null;
        document.getElementById('intern-detail-panel').classList.add('hidden');
        renderInternTable();
        updateStats();
    });

    document.getElementById('btn-toggle-new-akte').addEventListener('click', () => {
        document.getElementById('intern-new-akte-panel').classList.toggle('hidden');
    });

    document.getElementById('btn-close-new-akte').addEventListener('click', () => {
        document.getElementById('intern-new-akte-panel').classList.add('hidden');
    });

    document.getElementById('form-intern-new-akte').addEventListener('submit', async (e) => {
        e.preventDefault();
        const typ = document.getElementById('intern-new-typ').value;
        const status = document.getElementById('intern-new-status').value;
        const nameRaw = document.getElementById('intern-new-name').value.trim();
        const beteiligter = document.getElementById('intern-new-beteiligter').value.trim();
        const sachverhalt = document.getElementById('intern-new-sachverhalt').value.trim();

        const parts = nameRaw.split(' ');
        const vorname = parts.length > 1 ? parts.slice(0, -1).join(' ') : 'Dienststelle';
        const nachname = parts[parts.length - 1];
        const az = AktenAPI.generateAktenzeichen(typ);
        const heute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const author = document.getElementById('logged-user-display').textContent || 'Dienststelle';

        await AktenAPI.create({
            az,
            datum: heute,
            typ,
            vorname,
            nachname,
            behoerde: 'Internes Dienstportal (SenJustV)',
            beteiligter,
            sachverhalt,
            status,
            vermerk: `Direkt eröffnet durch ${author}.`,
            beweismittel: [],
            nachtraege: [{
                timestamp: getTimestampDE(),
                author,
                text: `Akte direkt im Dienstportal eröffnet (Status: ${status}).`
            }]
        });

        e.target.reset();
        document.getElementById('intern-new-akte-panel').classList.add('hidden');
        renderInternTable();
        updateStats();
        openAkteDetail(az);
    });

    document.getElementById('btn-save-akte').addEventListener('click', async () => {
        if (!currentSelectedAz) return;
        const status = document.getElementById('detail-status-select').value;
        const vermerk = document.getElementById('detail-vermerk').value;
        const bearbeiter = document.getElementById('detail-bearbeiter').value.trim();
        const paragraphen = document.getElementById('detail-paragraphen').value.trim();

        const akten = await AktenAPI.getAll();
        const akte = akten.find(a => a.az === currentSelectedAz);
        const patch = { status, vermerk, bearbeiter, paragraphen };

        if (akte && akte.status !== status) {
            let nachtraegeList = [];
            try {
                nachtraegeList = typeof akte.nachtraege === 'string'
                    ? JSON.parse(akte.nachtraege)
                    : (akte.nachtraege || []);
            } catch { nachtraegeList = []; }

            const author = document.getElementById('logged-user-display').textContent || 'Dienststelle';
            nachtraegeList.push({
                timestamp: getTimestampDE(),
                author,
                text: `[Status geändert: ${akte.status} → ${status}]`
            });
            patch.nachtraege = nachtraegeList;
        }

        await AktenAPI.update(currentSelectedAz, patch);
        logActivity('Akte bearbeitet', `Vorgang ${currentSelectedAz} aktualisiert (Status: ${status}).`);
        document.getElementById('save-feedback').classList.remove('hidden');
        renderInternTable();
        updateStats();
        if (patch.nachtraege) openAkteDetail(currentSelectedAz);
    });

    document.getElementById('form-add-nachtrag').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentSelectedAz) return;

        const text = document.getElementById('nachtrag-text').value.trim();
        const files = Array.from(document.getElementById('nachtrag-files').files || []);
        if (!text && files.length === 0) return;

        const akten = await AktenAPI.getAll();
        const akte = akten.find(a => a.az === currentSelectedAz);
        if (!akte) return;

        let bwmList = [];
        try {
            bwmList = typeof akte.beweismittel === 'string'
                ? JSON.parse(akte.beweismittel)
                : (akte.beweismittel || []);
        } catch { bwmList = []; }

        let nachtraegeList = [];
        try {
            nachtraegeList = typeof akte.nachtraege === 'string'
                ? JSON.parse(akte.nachtraege)
                : (akte.nachtraege || []);
        } catch { nachtraegeList = []; }

        const newBwms = [];
        for (const file of files) {
            const bwm = await readFileAsEvidence(file);
            bwmList.push(bwm);
            newBwms.push(bwm.kennung);
        }

        const timestamp = getTimestampDE();
        const author = document.getElementById('logged-user-display').textContent || 'Dienststelle';
        let entryText = text;
        if (newBwms.length > 0) {
            entryText = (entryText ? entryText + ' ' : '') + `[Beweismittel hinzugefügt: ${newBwms.join(', ')}]`;
        }

        nachtraegeList.push({
            timestamp,
            author,
            text: entryText
        });

        await AktenAPI.update(currentSelectedAz, {
            beweismittel: bwmList,
            nachtraege: nachtraegeList
        });

        e.target.reset();
        openAkteDetail(currentSelectedAz);
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
        document.getElementById('print-doc-title').textContent = docType === 'Ermittlungsakte'
            ? 'AMTLICHE ERMITTLUNGSAKTE'
            : docType.toUpperCase();

        const bodyEl = document.getElementById('print-doc-body');
        const signerEl = document.getElementById('print-signer');

        if (docType === 'Ermittlungsakte') {
            signerEl.textContent = 'Staatsanwaltschaft Berlin / Geschäftsstelle';

            let bwmList = [];
            try {
                bwmList = typeof akte.beweismittel === 'string'
                    ? JSON.parse(akte.beweismittel)
                    : (akte.beweismittel || []);
            } catch { bwmList = []; }

            let nachtraegeList = [];
            try {
                nachtraegeList = typeof akte.nachtraege === 'string'
                    ? JSON.parse(akte.nachtraege)
                    : (akte.nachtraege || []);
            } catch { nachtraegeList = []; }

            const bwmRows = bwmList.length === 0
                ? '<tr><td colspan="4" style="padding: 8px; border: 1px solid #999;">Keine Beweismittel hinterlegt.</td></tr>'
                : bwmList.map(b => {
                    const viewUrl = b.externalUrl
                        ? b.externalUrl
                        : `${window.location.origin}/api/beweismittel?az=${encodeURIComponent(akte.az)}&kennung=${encodeURIComponent(b.kennung)}`;
                    const linkHtml = (b.dataUrl || b.externalUrl)
                        ? `<a href="${escapeHtml(viewUrl)}" target="_blank" style="color:#003366; text-decoration:underline;">${escapeHtml(b.name)}</a>`
                        : escapeHtml(b.name);
                    return `
                    <tr>
                        <td style="border:1px solid #999; padding:6px 8px; white-space:nowrap; font-family:monospace; font-weight:bold;">${escapeHtml(b.kennung)}</td>
                        <td style="border:1px solid #999; padding:6px 8px;">${linkHtml}</td>
                        <td style="border:1px solid #999; padding:6px 8px; white-space:nowrap;">${escapeHtml(b.size || '')}</td>
                        <td style="border:1px solid #999; padding:6px 8px; white-space:nowrap;">${escapeHtml(b.addedAt || akte.datum)}</td>
                    </tr>
                `;
                }).join('');

            const bwmImages = bwmList
                .filter(b => b.dataUrl && (b.type || '').startsWith('image/'))
                .map(b => `
                    <div style="margin-top: 16px; padding: 10px; border: 1px solid #999; page-break-inside: avoid;">
                        <p style="margin: 0 0 8px 0;"><strong>Anlage ${escapeHtml(b.kennung)} (${escapeHtml(b.name)}):</strong></p>
                        <img src="${b.dataUrl}" style="max-width: 100%; max-height: 260px; border: 1px solid #000;">
                    </div>
                `).join('');

            const nachtraegeHtml = nachtraegeList.length === 0
                ? '<p style="color:#555; font-style:italic;">Keine weiteren Ermittlungsnachträge vorhanden.</p>'
                : nachtraegeList.map(n => `
                    <div style="border-left: 3px solid #000; padding: 6px 12px; margin-bottom: 10px; background: #F9F9F9;">
                        <strong>${escapeHtml(n.timestamp)}</strong> – <em>${escapeHtml(n.author)}</em><br>
                        <span>${escapeHtml(n.text)}</span>
                    </div>
                `).join('');

            bodyEl.innerHTML = `
                <div style="page-break-after: always; border: 2px solid #000; padding: 28px; margin-top: 10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
                        <span style="border: 2px solid #CC0000; color: #CC0000; padding: 4px 10px; font-weight: bold; font-size: 10pt; letter-spacing: 1px;">AMTLICHE AKTE · NUR FÜR DEN DIENSTGEBRAUCH</span>
                        <span style="font-family: monospace; font-size: 12pt; font-weight: bold;">AZ: ${escapeHtml(akte.az)}</span>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 11pt;">
                        <tr><th style="text-align:left; padding:8px; border:1px solid #999; background:#F2F2F2; width:36%;">Aktenzeichen</th><td style="padding:8px; border:1px solid #999;"><strong>${escapeHtml(akte.az)}</strong></td></tr>
                        <tr><th style="text-align:left; padding:8px; border:1px solid #999; background:#F2F2F2;">Vorgangsart</th><td style="padding:8px; border:1px solid #999;">${escapeHtml(akte.typ)}</td></tr>
                        <tr><th style="text-align:left; padding:8px; border:1px solid #999; background:#F2F2F2;">Eingangsdatum</th><td style="padding:8px; border:1px solid #999;">${escapeHtml(akte.datum)}</td></tr>
                        <tr><th style="text-align:left; padding:8px; border:1px solid #999; background:#F2F2F2;">Aktueller Status</th><td style="padding:8px; border:1px solid #999;"><strong>${escapeHtml(akte.status)}</strong></td></tr>
                        <tr><th style="text-align:left; padding:8px; border:1px solid #999; background:#F2F2F2;">Antragsteller / Dienststelle</th><td style="padding:8px; border:1px solid #999;">${escapeHtml(akte.vorname)} ${escapeHtml(akte.nachname)} (${escapeHtml(akte.behoerde)})</td></tr>
                        <tr><th style="text-align:left; padding:8px; border:1px solid #999; background:#F2F2F2;">Betroffene Person</th><td style="padding:8px; border:1px solid #999;">${escapeHtml(akte.beteiligter)}</td></tr>
                        <tr><th style="text-align:left; padding:8px; border:1px solid #999; background:#F2F2F2;">Zuständiger Sachbearbeiter</th><td style="padding:8px; border:1px solid #999;">${escapeHtml(akte.bearbeiter || 'Nicht zugewiesen')}</td></tr>
                        <tr><th style="text-align:left; padding:8px; border:1px solid #999; background:#F2F2F2;">Angewandte Paragraphen</th><td style="padding:8px; border:1px solid #999;">${escapeHtml(akte.paragraphen || 'Keine Angabe')}</td></tr>
                    </table>

                    <div style="border-top: 2px solid #000; padding-top: 14px;">
                        <p style="margin: 0 0 8px 0;"><strong>Aktenverzeichnis:</strong></p>
                        <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
                            <li>Sachverhalt &amp; Tatvorwurf</li>
                            <li>Beweismittel-Verzeichnis (${bwmList.length} ${bwmList.length === 1 ? 'Anlage' : 'Anlagen'})</li>
                            <li>Chronologie der Ermittlungsnachträge (${nachtraegeList.length} ${nachtraegeList.length === 1 ? 'Eintrag' : 'Einträge'})</li>
                            <li>Interner Vermerk / Verfügung</li>
                        </ol>
                    </div>
                </div>

                <h3 style="border-bottom: 2px solid #000; padding-bottom: 4px; margin-top: 0;">1. Sachverhalt &amp; Tatvorwurf</h3>
                <div style="border: 1px solid #999; padding: 12px; background: #FAFAFA; white-space: pre-wrap; margin-bottom: 22px;">${escapeHtml(akte.sachverhalt)}</div>

                <h3 style="border-bottom: 2px solid #000; padding-bottom: 4px;">2. Beweismittel-Verzeichnis</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 22px;">
                    <thead>
                        <tr style="background: #E9ECEF;">
                            <th style="border:1px solid #999; padding:6px 8px; text-align:left;">Kennung</th>
                            <th style="border:1px solid #999; padding:6px 8px; text-align:left;">Bezeichnung / Datei</th>
                            <th style="border:1px solid #999; padding:6px 8px; text-align:left;">Größe</th>
                            <th style="border:1px solid #999; padding:6px 8px; text-align:left;">Erfasst am</th>
                        </tr>
                    </thead>
                    <tbody>${bwmRows}</tbody>
                </table>
                ${bwmImages}

                <h3 style="border-bottom: 2px solid #000; padding-bottom: 4px;">3. Chronologie der Ermittlungsnachträge &amp; Aussagen</h3>
                <div style="margin-bottom: 22px;">${nachtraegeHtml}</div>

                <h3 style="border-bottom: 2px solid #000; padding-bottom: 4px;">4. Interner Vermerk / Verfügung</h3>
                <div style="border: 1px solid #999; padding: 12px; background: #FAFAFA; white-space: pre-wrap;">${escapeHtml(akte.vermerk || 'Kein Vermerk hinterlegt.')}</div>
            `;
        } else if (docType === 'Haftbefehl') {
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
        } else if (docType === 'Einstellungsverfügung') {
            signerEl.textContent = akte.bearbeiter || 'Staatsanwalt/-anwältin – Staatsanwaltschaft Berlin';
            bodyEl.innerHTML = `
                <p>In dem Ermittlungsverfahren gegen <strong>${escapeHtml(akte.beteiligter)}</strong> wegen <strong>${escapeHtml(akte.paragraphen || 'des bekannten Tatvorwurfs')}</strong> wird das Verfahren gemäß § 170 Abs. 2 StPO eingestellt.</p>
                <p><strong>Begründung:</strong><br>${escapeHtml(akte.vermerk || 'Die Ermittlungen haben keinen hinreichenden Tatverdacht für die Erhebung der öffentlichen Klage ergeben.')}</p>
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
    let selectedPublicLawId = null;

    gesetzeFilterBook.addEventListener('change', () => {
        selectedPublicBookId = gesetzeFilterBook.value === 'alle' ? null : gesetzeFilterBook.value;
        selectedPublicLawId = null;
        renderGesetzePublic();
    });
    gesetzeFilterSearch.addEventListener('input', renderGesetzePublic);

    async function renderGesetzePublic() {
        syncUrlHash('gesetze');
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

            const layout = document.createElement('div');
            layout.className = 'law-reader-layout';

            // Linke Spalte: Inhaltsverzeichnis (mit aufklappbaren Abschnitten)
            const toc = document.createElement('aside');
            toc.className = 'law-toc';
            toc.innerHTML = `<h4 class="law-toc-title">Inhaltsverzeichnis (${escapeHtml(book.short)})</h4><div class="toc-container"></div>`;
            const tocContainer = toc.querySelector('.toc-container');

            // Aktiven Paragraphen bestimmen (Standard: erster Paragraph)
            let activeIdx = laws.findIndex(l => l.id === selectedPublicLawId);
            if (activeIdx === -1) {
                activeIdx = 0;
                selectedPublicLawId = laws[0].id;
            }
            const activeLaw = laws[activeIdx];

            const noSectionLaws = laws.filter(l => !l.section);
            if (noSectionLaws.length > 0) {
                const ul = document.createElement('ul');
                ul.className = 'law-toc-list';
                noSectionLaws.forEach(law => {
                    const isActive = law.id === activeLaw.id;
                    const li = document.createElement('li');
                    li.innerHTML = `<a href="#law-${law.id}" class="toc-jump${isActive ? ' active' : ''}" data-law-id="${law.id}"><strong>${escapeHtml(law.paragraph)}</strong> ${escapeHtml(law.title)}</a>`;
                    ul.appendChild(li);
                });
                tocContainer.appendChild(ul);
            }

            const sections = [...new Set(laws.map(l => l.section).filter(Boolean))];
            sections.forEach(secName => {
                const secLaws = laws.filter(l => l.section === secName);
                const details = document.createElement('details');
                details.className = 'toc-section';
                details.open = true;
                details.innerHTML = `<summary>${escapeHtml(secName)}</summary><ul class="law-toc-list"></ul>`;
                const ul = details.querySelector('.law-toc-list');
                secLaws.forEach(law => {
                    const isActive = law.id === activeLaw.id;
                    const li = document.createElement('li');
                    li.innerHTML = `<a href="#law-${law.id}" class="toc-jump${isActive ? ' active' : ''}" data-law-id="${law.id}"><strong>${escapeHtml(law.paragraph)}</strong> ${escapeHtml(law.title)}</a>`;
                    ul.appendChild(li);
                });
                tocContainer.appendChild(details);
            });

            // Rechte Spalte: Einzelne Gesetzes-Seite
            const contentArea = document.createElement('div');
            contentArea.className = 'law-content-area';

            const prevLaw = activeIdx > 0 ? laws[activeIdx - 1] : null;
            const nextLaw = activeIdx < laws.length - 1 ? laws[activeIdx + 1] : null;

            contentArea.innerHTML = `
                <article class="law-article" style="border-bottom: none; padding: 0;">
                    <div class="law-article-header">
                        <h4 class="law-article-title" style="font-size: 20px;">${escapeHtml(activeLaw.paragraph)} ${escapeHtml(activeLaw.title)}</h4>
                        <span class="law-article-meta">Stand: ${escapeHtml(activeLaw.updatedAt || 'Initial')}</span>
                    </div>
                    <div class="law-text-formatted" style="margin-top: 14px;">${formatLawTextHtml(activeLaw.text)}</div>
                </article>
                <div class="law-pagination">
                    <div>${prevLaw ? `<button type="button" class="btn-secondary btn-small btn-law-nav" data-law-id="${prevLaw.id}">&larr; ${escapeHtml(prevLaw.paragraph)}</button>` : ''}</div>
                    <span class="demo-hint" style="margin: 0;">Paragraph ${activeIdx + 1} von ${laws.length}</span>
                    <div>${nextLaw ? `<button type="button" class="btn-secondary btn-small btn-law-nav" data-law-id="${nextLaw.id}">${escapeHtml(nextLaw.paragraph)} &rarr;</button>` : ''}</div>
                </div>
            `;

            layout.appendChild(toc);
            layout.appendChild(contentArea);
            section.appendChild(layout);
            container.appendChild(section);
        });

        container.querySelectorAll('.toc-jump, .btn-law-nav').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                selectedPublicLawId = Number(el.dataset.lawId);
                renderGesetzePublic();
            });
        });

        container.querySelectorAll('.law-ref-link').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                const ref = link.dataset.ref;
                const d = await GesetzeAPI.getAll();
                const targetBook = d.books.find(b => ref.startsWith(b.short + ' '));
                if (targetBook) {
                    const targetLaw = d.laws.find(l => l.bookId === targetBook.id && `${targetBook.short} ${l.paragraph}` === ref);
                    selectedPublicBookId = targetBook.id;
                    selectedPublicLawId = targetLaw ? targetLaw.id : null;
                    gesetzeFilterSearch.value = '';
                    await renderGesetzePublic();
                }
            });
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
        updateNextParagraphPlaceholder(data);

        // Abschnitt-Dropdowns aktualisieren
        const allSections = [...new Set(data.laws.map(l => l.section).filter(Boolean))];
        ['law-section-select', 'edit-law-section-select'].forEach(selId => {
            const sel = document.getElementById(selId);
            const prev = sel.value;
            sel.innerHTML = '<option value="">-- Ohne Abschnitt --</option>';
            allSections.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                sel.appendChild(opt);
            });
            const newOpt = document.createElement('option');
            newOpt.value = '__new__';
            newOpt.textContent = '+ Neuen Abschnitt eingeben...';
            sel.appendChild(newOpt);
            if (prev && (allSections.includes(prev) || prev === '__new__')) sel.value = prev;
        });

        // Checkbox-Liste für Zwischenüberschrift-Zuweisung befüllen
        const bulkLawsEl = document.getElementById('bulk-section-laws');
        if (data.laws.length === 0) {
            bulkLawsEl.innerHTML = '<span class="demo-hint">Noch keine Paragraphen vorhanden.</span>';
        } else {
            const sortedAll = [...data.laws].sort((a, b) => a.paragraph.localeCompare(b.paragraph, 'de', { numeric: true }));
            bulkLawsEl.innerHTML = sortedAll.map(l => {
                const bk = data.books.find(b => b.id === l.bookId);
                const short = bk ? bk.short : l.bookId;
                const secBadge = l.section
                    ? ` <span style="background:#E8EEF5; color:#003366; padding:1px 6px; border-radius:3px; font-size:11px; margin-left:4px;">${escapeHtml(l.section)}</span>`
                    : '';
                return `<label style="display:flex; align-items:center; gap:6px; margin-bottom:4px; font-weight:normal; cursor:pointer;">
                    <input type="checkbox" class="bulk-law-cb" value="${l.id}" style="width:auto;">
                    <span><strong>${escapeHtml(short)} ${escapeHtml(l.paragraph)}</strong> – ${escapeHtml(l.title)}${secBadge}</span>
                </label>`;
            }).join('');
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
                    const ok = await showConfirmModal(
                        'Gesetzbuch löschen',
                        'Möchten Sie dieses Gesetzbuch und alle darin enthaltenen Paragraphen wirklich unwiderruflich löschen?'
                    );
                    if (!ok) return;
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
            tbody.innerHTML = '<tr><td colspan="6">Noch keine Vorschriften vorhanden.</td></tr>';
            return;
        }

        filteredLaws.forEach(law => {
            const book = data.books.find(b => b.id === law.bookId);
            const tr = document.createElement('tr');
            const secOptions = [`<option value="">-- Ohne Abschnitt --</option>`]
                .concat(allSections.map(s => `<option value="${escapeHtml(s)}"${law.section === s ? ' selected' : ''}>${escapeHtml(s)}</option>`))
                .join('');

            tr.innerHTML = `
                <td>${escapeHtml(book ? book.short : law.bookId)}</td>
                <td class="mono-bold">${escapeHtml(law.paragraph)}</td>
                <td>${escapeHtml(law.title)}</td>
                <td><select class="inline-section-select" data-id="${law.id}" style="padding:4px 6px; font-size:13px; border:1px solid var(--border-dark); border-radius:4px; max-width:200px;">${secOptions}</select></td>
                <td>${escapeHtml(law.updatedAt || 'Initial')}</td>
                <td>
                    <button type="button" class="btn-secondary btn-small btn-edit-law" data-id="${law.id}">Bearbeiten</button>
                    <button type="button" class="btn-secondary btn-small btn-del-law" data-id="${law.id}">Löschen</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.inline-section-select').forEach(sel => {
            sel.addEventListener('change', async () => {
                const id = Number(sel.dataset.id);
                const law = data.laws.find(l => l.id === id);
                if (!law) return;
                await GesetzeAPI.updateLaw(id, {
                    paragraph: law.paragraph,
                    title: law.title,
                    text: law.text,
                    section: sel.value
                });
                renderGesetzeIntern();
                renderGesetzePublic();
            });
        });

        document.querySelectorAll('.btn-edit-law').forEach(btn => {
            btn.addEventListener('click', () => {
                const law = data.laws.find(l => l.id === Number(btn.dataset.id));
                if (!law) return;
                document.getElementById('edit-law-id').value = law.id;
                document.getElementById('edit-law-paragraph').value = law.paragraph;
                document.getElementById('edit-law-title').value = law.title;
                document.getElementById('edit-law-section-select').value = law.section || '';
                document.getElementById('edit-law-section').classList.add('hidden');
                document.getElementById('edit-law-section').value = '';
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
    document.getElementById('btn-cancel-edit-law-top').addEventListener('click', () => {
        document.getElementById('edit-law-panel').classList.add('hidden');
    });

    const editLawTextInput = document.getElementById('edit-law-text');
    const editLawLivePreview = document.getElementById('edit-law-live-preview');

    document.getElementById('btn-edit-insert-bold').addEventListener('click', () => {
        wrapSelection(editLawTextInput, '**', '**');
    });

    document.getElementById('btn-edit-insert-underline').addEventListener('click', () => {
        wrapSelection(editLawTextInput, '__', '__');
    });

    document.getElementById('btn-edit-insert-nr').addEventListener('click', () => {
        const matches = editLawTextInput.value.match(/^\d+\./gm);
        const nextNr = (matches ? matches.length : 0) + 1;
        const prefix = editLawTextInput.value && !editLawTextInput.value.endsWith('\n') ? '\n' : '';
        insertAtCursor(editLawTextInput, `${prefix}${nextNr}. `);
    });

    document.getElementById('btn-edit-insert-absatz').addEventListener('click', () => {
        const matches = editLawTextInput.value.match(/\(\d+\)/g);
        const nextAbs = (matches ? matches.length : 0) + 1;
        const prefix = editLawTextInput.value && !editLawTextInput.value.endsWith('\n') ? '\n' : '';
        insertAtCursor(editLawTextInput, `${prefix}(${nextAbs}) `);
    });

    document.getElementById('btn-edit-insert-bullet').addEventListener('click', () => {
        const prefix = editLawTextInput.value && !editLawTextInput.value.endsWith('\n') ? '\n' : '';
        insertAtCursor(editLawTextInput, `${prefix}• `);
    });

    document.getElementById('btn-edit-insert-ref').addEventListener('click', () => {
        insertAtCursor(editLawTextInput, '@');
        editLawTextInput.dispatchEvent(new Event('input'));
    });

    document.getElementById('btn-edit-toggle-preview').addEventListener('click', () => {
        if (editLawLivePreview.classList.contains('hidden')) {
            editLawLivePreview.innerHTML = editLawTextInput.value.trim()
                ? formatLawTextHtml(editLawTextInput.value)
                : '<em>Noch kein Text eingegeben.</em>';
            editLawLivePreview.classList.remove('hidden');
        } else {
            editLawLivePreview.classList.add('hidden');
        }
    });

    document.getElementById('law-section-select').addEventListener('change', (e) => {
        document.getElementById('law-section').classList.toggle('hidden', e.target.value !== '__new__');
    });
    document.getElementById('edit-law-section-select').addEventListener('change', (e) => {
        document.getElementById('edit-law-section').classList.toggle('hidden', e.target.value !== '__new__');
    });

    document.getElementById('form-edit-law').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = Number(document.getElementById('edit-law-id').value);
        const paragraph = document.getElementById('edit-law-paragraph').value.trim();
        const title = document.getElementById('edit-law-title').value.trim();
        const secSel = document.getElementById('edit-law-section-select').value;
        const section = secSel === '__new__'
            ? document.getElementById('edit-law-section').value.trim()
            : secSel;
        const text = document.getElementById('edit-law-text').value.trim();
        if (!id || !paragraph || !title || !text) return;

        await GesetzeAPI.updateLaw(id, { paragraph, title, text, section });
        document.getElementById('edit-law-panel').classList.add('hidden');
        renderGesetzeIntern();
        renderGesetzePublic();
    });

    document.getElementById('btn-assign-section').addEventListener('click', async () => {
        const secName = document.getElementById('bulk-section-name').value.trim();
        const checkedIds = Array.from(document.querySelectorAll('.bulk-law-cb:checked')).map(cb => Number(cb.value));
        const msgEl = document.getElementById('bulk-section-msg');

        if (!secName || checkedIds.length === 0) {
            msgEl.textContent = 'Bitte Namen eingeben und mindestens 1 Paragraphen wählen.';
            msgEl.style.color = '#CC0000';
            msgEl.classList.remove('hidden');
            setTimeout(() => { msgEl.classList.add('hidden'); msgEl.style.color = ''; }, 3000);
            return;
        }

        const data = await GesetzeAPI.getAll();
        for (const id of checkedIds) {
            const law = data.laws.find(l => l.id === id);
            if (law) {
                await GesetzeAPI.updateLaw(id, {
                    paragraph: law.paragraph,
                    title: law.title,
                    text: law.text,
                    section: secName
                });
            }
        }
        document.getElementById('bulk-section-name').value = '';
        msgEl.textContent = `✓ Zugewiesen (${checkedIds.length} Vorschriften).`;
        msgEl.style.color = '#006600';
        msgEl.classList.remove('hidden');
        setTimeout(() => msgEl.classList.add('hidden'), 3000);
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
        const secSel = document.getElementById('law-section-select').value;
        const section = secSel === '__new__'
            ? document.getElementById('law-section').value.trim()
            : secSel;
        const title = document.getElementById('law-title').value.trim();
        const text = document.getElementById('law-text').value.trim();
        if (!bookId || !title || !text) return;

        await GesetzeAPI.addLaw(bookId, title, text, customParagraph, section);
        document.getElementById('law-paragraph').value = '';
        document.getElementById('law-section').value = '';
        document.getElementById('law-section').classList.add('hidden');
        document.getElementById('law-title').value = '';
        document.getElementById('law-text').value = '';
        document.getElementById('law-save-msg').classList.remove('hidden');
        renderGesetzeIntern();
        renderGesetzePublic();
    });

    function formatLawTextHtml(rawText) {
        let html = escapeHtml(rawText || '');
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<u>$1</u>');
        html = html.replace(/\[\[([^\]]+)\]\]/g, (match, ref) => {
            return `<a href="#gesetze" class="law-ref-link" data-ref="${ref}">${ref}</a>`;
        });
        const lines = html.split('\n');
        let result = '';
        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (/^[•\-]\s+/.test(trimmed)) {
                result += `<div class="law-bullet-item">${trimmed}</div>`;
            } else if (/^\(\d+\)\s+/.test(trimmed)) {
                result += `<div class="law-absatz">${trimmed}</div>`;
            } else {
                result += (idx > 0 && !lines[idx - 1].trim().match(/^([•\-]|\(\d+\))\s+/) ? '\n' : '') + line;
            }
        });
        return result;
    }

    // @-Autocomplete & Editor-Toolbar für Gesetzestext
    const lawTextInput = document.getElementById('law-text');
    const lawRefAutocomplete = document.getElementById('law-ref-autocomplete');
    const lawBookSelect = document.getElementById('law-book-select');
    const lawParagraphInput = document.getElementById('law-paragraph');
    const lawLivePreview = document.getElementById('law-live-preview');

    function updateNextParagraphPlaceholder(data) {
        const bookId = lawBookSelect.value;
        if (!bookId) {
            lawParagraphInput.placeholder = 'Leer = automatisch, z. B. § 2a';
            return;
        }
        const count = data.laws.filter(l => l.bookId === bookId).length;
        lawParagraphInput.placeholder = `Automatisch: § ${count + 1} (oder z. B. § 2a)`;
    }

    lawBookSelect.addEventListener('change', async () => {
        const data = await GesetzeAPI.getAll();
        updateNextParagraphPlaceholder(data);

        // Abschnitt-Dropdowns aktualisieren
        const allSections = [...new Set(data.laws.map(l => l.section).filter(Boolean))];
        ['law-section-select', 'edit-law-section-select'].forEach(selId => {
            const sel = document.getElementById(selId);
            const prev = sel.value;
            sel.innerHTML = '<option value="">-- Ohne Abschnitt --</option>';
            allSections.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                sel.appendChild(opt);
            });
            const newOpt = document.createElement('option');
            newOpt.value = '__new__';
            newOpt.textContent = '+ Neuen Abschnitt eingeben...';
            sel.appendChild(newOpt);
            if (prev && (allSections.includes(prev) || prev === '__new__')) sel.value = prev;
        });

        // Checkbox-Liste für Zwischenüberschrift-Zuweisung befüllen
        const bulkLawsEl = document.getElementById('bulk-section-laws');
        if (data.laws.length === 0) {
            bulkLawsEl.innerHTML = '<span class="demo-hint">Noch keine Paragraphen vorhanden.</span>';
        } else {
            const sortedAll = [...data.laws].sort((a, b) => a.paragraph.localeCompare(b.paragraph, 'de', { numeric: true }));
            bulkLawsEl.innerHTML = sortedAll.map(l => {
                const bk = data.books.find(b => b.id === l.bookId);
                const short = bk ? bk.short : l.bookId;
                const secBadge = l.section
                    ? ` <span style="background:#E8EEF5; color:#003366; padding:1px 6px; border-radius:3px; font-size:11px; margin-left:4px;">${escapeHtml(l.section)}</span>`
                    : '';
                return `<label style="display:flex; align-items:center; gap:6px; margin-bottom:4px; font-weight:normal; cursor:pointer;">
                    <input type="checkbox" class="bulk-law-cb" value="${l.id}" style="width:auto;">
                    <span><strong>${escapeHtml(short)} ${escapeHtml(l.paragraph)}</strong> – ${escapeHtml(l.title)}${secBadge}</span>
                </label>`;
            }).join('');
        }
    });

    function insertAtCursor(textarea, textToInsert) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = textarea.value;
        textarea.value = val.slice(0, start) + textToInsert + val.slice(end);
        textarea.focus();
        const pos = start + textToInsert.length;
        textarea.setSelectionRange(pos, pos);
    }

    function wrapSelection(textarea, prefix, suffix) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = textarea.value;
        const selected = val.slice(start, end) || 'Text';
        textarea.value = val.slice(0, start) + prefix + selected + suffix + val.slice(end);
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }

    document.getElementById('btn-insert-bold').addEventListener('click', () => {
        wrapSelection(lawTextInput, '**', '**');
    });

    document.getElementById('btn-insert-underline').addEventListener('click', () => {
        wrapSelection(lawTextInput, '__', '__');
    });

    document.getElementById('btn-insert-nr').addEventListener('click', () => {
        const matches = lawTextInput.value.match(/^\d+\./gm);
        const nextNr = (matches ? matches.length : 0) + 1;
        const prefix = lawTextInput.value && !lawTextInput.value.endsWith('\n') ? '\n' : '';
        insertAtCursor(lawTextInput, `${prefix}${nextNr}. `);
    });

    document.getElementById('btn-insert-absatz').addEventListener('click', () => {
        const matches = lawTextInput.value.match(/\(\d+\)/g);
        const nextAbs = (matches ? matches.length : 0) + 1;
        const prefix = lawTextInput.value && !lawTextInput.value.endsWith('\n') ? '\n' : '';
        insertAtCursor(lawTextInput, `${prefix}(${nextAbs}) `);
    });

    document.getElementById('btn-insert-bullet').addEventListener('click', () => {
        const prefix = lawTextInput.value && !lawTextInput.value.endsWith('\n') ? '\n' : '';
        insertAtCursor(lawTextInput, `${prefix}• `);
    });

    document.getElementById('btn-insert-ref').addEventListener('click', () => {
        insertAtCursor(lawTextInput, '@');
        lawTextInput.dispatchEvent(new Event('input'));
    });

    document.getElementById('btn-toggle-law-preview').addEventListener('click', () => {
        if (lawLivePreview.classList.contains('hidden')) {
            lawLivePreview.innerHTML = lawTextInput.value.trim()
                ? formatLawTextHtml(lawTextInput.value)
                : '<em>Noch kein Text eingegeben.</em>';
            lawLivePreview.classList.remove('hidden');
        } else {
            lawLivePreview.classList.add('hidden');
        }
    });

    lawTextInput.addEventListener('input', async () => {
        const val = lawTextInput.value;
        const cursorPos = lawTextInput.selectionStart;
        const textBeforeCursor = val.slice(0, cursorPos);
        const atMatch = textBeforeCursor.match(/@([^\s@\[\]]*)$/);

        if (!atMatch) {
            lawRefAutocomplete.classList.add('hidden');
            return;
        }

        const query = atMatch[1].toLowerCase();
        const data = await GesetzeAPI.getAll();
        const items = data.laws.map(l => {
            const book = data.books.find(b => b.id === l.bookId);
            const short = book ? book.short : l.bookId;
            return {
                ref: `${short} ${l.paragraph}`,
                label: `${short} ${l.paragraph} – ${l.title}`
            };
        }).filter(item => item.label.toLowerCase().includes(query));

        if (items.length === 0) {
            lawRefAutocomplete.classList.add('hidden');
            return;
        }

        lawRefAutocomplete.innerHTML = '';
        items.slice(0, 10).forEach(item => {
            const div = document.createElement('div');
            div.className = 'ref-autocomplete-item';
            div.textContent = item.label;
            div.addEventListener('click', () => {
                const startIdx = textBeforeCursor.lastIndexOf('@');
                const before = val.slice(0, startIdx);
                const after = val.slice(cursorPos);
                const insert = `[[${item.ref}]] `;
                lawTextInput.value = before + insert + after;
                lawTextInput.focus();
                const newPos = before.length + insert.length;
                lawTextInput.setSelectionRange(newPos, newPos);
                lawRefAutocomplete.classList.add('hidden');
            });
            lawRefAutocomplete.appendChild(div);
        });
        lawRefAutocomplete.classList.remove('hidden');
    });

    // --- Aktivitäts- & Audit-Log ---
    async function logActivity(action, details) {
        const user = document.getElementById('logged-user-display').textContent || 'Dienststelle';
        await LogsAPI.add(user, action, details);
    }

    async function renderLogsIntern() {
        const tbody = document.getElementById('intern-logs-tbody');
        const search = document.getElementById('logs-filter-search').value.trim().toLowerCase();
        const logs = await LogsAPI.getAll();

        const filtered = logs.filter(l => {
            if (!search) return true;
            return (l.user || '').toLowerCase().includes(search) ||
                (l.action || '').toLowerCase().includes(search) ||
                (l.details || '').toLowerCase().includes(search);
        });

        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">Noch keine Aktivitäten protokolliert.</td></tr>';
            return;
        }

        filtered.forEach(l => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="white-space:nowrap;">${escapeHtml(l.timestamp)}</td>
                <td><strong>${escapeHtml(l.user)}</strong></td>
                <td>${escapeHtml(l.action)}</td>
                <td>${escapeHtml(l.details)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('logs-filter-search').addEventListener('input', renderLogsIntern);
    document.getElementById('btn-refresh-logs').addEventListener('click', renderLogsIntern);

    async function renderRolesIntern() {
        const tbody = document.getElementById('intern-roles-tbody');
        try {
            const res = await fetch('/api/roles');
            if (!res.ok) return;
            const roles = await res.json();

            tbody.innerHTML = '';
            if (roles.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8">Noch keine Discord-Rollen hinterlegt.</td></tr>';
                return;
            }

            roles.forEach(role => {
                const tr = document.createElement('tr');
                const hasLogin = role.perms.includes('login');
                const hasAkten = role.perms.includes('akten');
                const hasAktenEdit = role.perms.includes('akten_edit');
                const hasAktenDelete = role.perms.includes('akten_delete');
                const hasGesetze = role.perms.includes('gesetze');
                const hasLogs = role.perms.includes('logs');
                const hasRoles = role.perms.includes('roles');
                const membersText = (role.members && role.members.length > 0)
                    ? `${role.members.length}: ${role.members.slice(0, 4).join(', ')}${role.members.length > 4 ? ' …' : ''}`
                    : '<span style="color:#888;">–</span>';
                tr.innerHTML = `
                    <td title="Discord-ID: ${escapeHtml(role.id)}"><strong>${escapeHtml(role.name)}</strong></td>
                    <td style="font-size:12.5px; max-width:200px;">${role.members && role.members.length > 0 ? escapeHtml(membersText) : membersText}</td>
                    <td style="text-align:center;"><input type="checkbox" class="role-perm-cb" data-id="${escapeHtml(role.id)}" data-perm="login" ${hasLogin ? 'checked' : ''} style="width:auto; cursor:pointer;"></td>
                    <td style="text-align:center;"><input type="checkbox" class="role-perm-cb" data-id="${escapeHtml(role.id)}" data-perm="akten" ${hasAkten ? 'checked' : ''} style="width:auto; cursor:pointer;"></td>
                    <td style="text-align:center;"><input type="checkbox" class="role-perm-cb" data-id="${escapeHtml(role.id)}" data-perm="akten_edit" ${hasAktenEdit ? 'checked' : ''} style="width:auto; cursor:pointer;"></td>
                    <td style="text-align:center;"><input type="checkbox" class="role-perm-cb" data-id="${escapeHtml(role.id)}" data-perm="akten_delete" ${hasAktenDelete ? 'checked' : ''} style="width:auto; cursor:pointer;"></td>
                    <td style="text-align:center;"><input type="checkbox" class="role-perm-cb" data-id="${escapeHtml(role.id)}" data-perm="gesetze" ${hasGesetze ? 'checked' : ''} style="width:auto; cursor:pointer;"></td>
                    <td style="text-align:center;"><input type="checkbox" class="role-perm-cb" data-id="${escapeHtml(role.id)}" data-perm="logs" ${hasLogs ? 'checked' : ''} style="width:auto; cursor:pointer;"></td>
                    <td style="text-align:center;"><input type="checkbox" class="role-perm-cb" data-id="${escapeHtml(role.id)}" data-perm="roles" ${hasRoles ? 'checked' : ''} style="width:auto; cursor:pointer;"></td>
                    <td><button type="button" class="btn-secondary btn-small btn-del-role" data-id="${escapeHtml(role.id)}">Löschen</button></td>
                `;
                tbody.appendChild(tr);
            });

            tbody.querySelectorAll('.role-perm-cb').forEach(cb => {
                cb.addEventListener('change', async () => {
                    const roleId = cb.dataset.id;
                    const role = roles.find(r => r.id === roleId);
                    if (!role) return;
                    const rowCbs = tbody.querySelectorAll(`.role-perm-cb[data-id="${CSS.escape(roleId)}"]`);
                    const newPerms = Array.from(rowCbs).filter(c => c.checked).map(c => c.dataset.perm);
                    await fetch('/api/roles', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: role.id, name: role.name, perms: newPerms })
                    });
                    logActivity('Rolle geändert', `Berechtigungen für "${role.name}" aktualisiert.`);
                });
            });

            tbody.querySelectorAll('.btn-del-role').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await fetch(`/api/roles?id=${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' });
                    logActivity('Rolle gelöscht', `Discord-Rolle ${btn.dataset.id} entfernt.`);
                    renderRolesIntern();
                });
            });
        } catch {}
    }

    document.getElementById('btn-refresh-roles').addEventListener('click', renderRolesIntern);

    document.getElementById('form-add-role').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-role-name').value.trim();
        const id = document.getElementById('new-role-id').value.trim();
        const perms = [];
        if (document.getElementById('new-role-perm-akten').checked) perms.push('akten');
        if (document.getElementById('new-role-perm-akten-edit').checked) perms.push('akten_edit');
        if (document.getElementById('new-role-perm-akten-delete').checked) perms.push('akten_delete');
        if (document.getElementById('new-role-perm-gesetze').checked) perms.push('gesetze');
        if (document.getElementById('new-role-perm-logs').checked) perms.push('logs');

        const res = await fetch('/api/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name, perms })
        });
        if (res.ok) {
            e.target.reset();
            document.getElementById('new-role-perm-akten').checked = true;
            const msg = document.getElementById('role-save-msg');
            msg.classList.remove('hidden');
            setTimeout(() => msg.classList.add('hidden'), 2500);
            logActivity('Rolle hinzugefügt', `Discord-Rolle "${name}" (${id}) angelegt.`);
            renderRolesIntern();
        }
    });

    async function renderBansIntern() {
        const tbody = document.getElementById('intern-bans-tbody');
        try {
            const res = await fetch('/api/bans');
            if (!res.ok) return;
            const bans = await res.json();
            tbody.innerHTML = '';
            if (bans.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">Keine Benutzer gesperrt.</td></tr>';
                return;
            }
            bans.forEach(b => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="mono-bold">${escapeHtml(b.user_id)}</td>
                    <td>${escapeHtml(b.name)}</td>
                    <td>${escapeHtml(b.reason)}</td>
                    <td>${escapeHtml(b.bannedAt)}</td>
                    <td><button type="button" class="btn-secondary btn-small btn-unban" data-id="${escapeHtml(b.user_id)}">Entsperren</button></td>
                `;
                tbody.appendChild(tr);
            });
            tbody.querySelectorAll('.btn-unban').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await fetch(`/api/bans?id=${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' });
                    logActivity('Benutzer entsperrt', `Discord-User ${btn.dataset.id} entsperrt.`);
                    renderBansIntern();
                });
            });
        } catch {}
    }

    document.getElementById('form-ban-user').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user_id = document.getElementById('ban-user-id').value.trim();
        const name = document.getElementById('ban-user-name').value.trim();
        const reason = document.getElementById('ban-user-reason').value.trim();
        if (!user_id) return;

        const res = await fetch('/api/bans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id, name, reason })
        });
        if (res.ok) {
            e.target.reset();
            logActivity('Benutzer gesperrt', `Discord-User ${user_id} (${name || 'ohne Name'}) gesperrt.`);
            renderBansIntern();
        }
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
