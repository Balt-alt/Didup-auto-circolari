// ==UserScript==
// @name         Argo – Presa Visione Automatica v4
// @namespace    https://www.portaleargo.it/
// @version      4.1
// @description  Gestione virtual-scroll ExtJS: scorre man mano e processa le circolari in viewport
// @author       custom
// @match        https://www.portaleargo.it/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const CFG = {
        delayAfterFileClick   : 1500,
        delayAfterAttachClick : 800,
        delayAfterIndietro    : 1800,
        delayAfterPVClick     : 1200,
        delayAfterOk          : 900,
        delayBetweenRows      : 700,
        scrollStep            : 300,   // px per passo di scroll quando non si trovano icone
        scrollStepDelay       : 350,   // ms tra un passo e l'altro
        maxIterations         : 500,
    };

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function visible(selector) {
        return Array.from(document.querySelectorAll(selector))
            .filter(el => el.offsetParent !== null);
    }

    function clickButtonByText(text) {
        const span = visible('span.x-btn-inner').find(
            el => el.textContent.trim() === text
        );
        if (!span) return false;
        (span.closest('a') || span.closest('button') || span.parentElement).click();
        return true;
    }

    /* ── UI ── */
    const panel = document.createElement('div');
    panel.style.cssText = `
        position:fixed;top:12px;right:12px;z-index:2147483647;
        background:#1e293b;color:#f1f5f9;border-radius:10px;padding:12px 14px;
        font-family:system-ui,sans-serif;font-size:13px;
        box-shadow:0 4px 20px rgba(0,0,0,.5);min-width:250px;max-width:330px;
    `;
    panel.innerHTML = `
        <div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#7dd3fc;">
            📋 Argo – Presa Visione Auto
        </div>
        <button id="__av_start__" style="background:#22c55e;color:#fff;border:none;
            border-radius:6px;padding:7px 12px;cursor:pointer;font-size:13px;
            font-weight:600;width:100%;margin-bottom:6px;">▶ Avvia presa visione</button>
        <button id="__av_stop__" style="background:#ef4444;color:#fff;border:none;
            border-radius:6px;padding:6px 12px;cursor:pointer;font-size:13px;
            font-weight:600;width:100%;margin-bottom:6px;display:none;">⏹ Stop</button>
        <div id="__av_log__" style="background:#0f172a;border-radius:6px;padding:7px;
            max-height:180px;overflow-y:auto;font-size:11px;line-height:1.5;
            display:none;color:#94a3b8;"></div>
        <div id="__av_status__" style="font-size:12px;color:#94a3b8;margin-top:5px;">
            Pronto. Naviga alla sezione Circolari poi premi Avvia.
        </div>
    `;
    document.body.appendChild(panel);

    const startBtn  = document.getElementById('__av_start__');
    const stopBtn   = document.getElementById('__av_stop__');
    const logBox    = document.getElementById('__av_log__');
    const statusDiv = document.getElementById('__av_status__');

    let running = false, shouldStop = false;

    function log(msg, color = '#94a3b8') {
        logBox.style.display = 'block';
        const d = document.createElement('div');
        d.style.color = color;
        d.textContent = `[${new Date().toLocaleTimeString('it-IT')}] ${msg}`;
        logBox.appendChild(d);
        logBox.scrollTop = logBox.scrollHeight;
    }
    function setStatus(msg) { statusDiv.textContent = msg; }

    /* ──────────────────────────────────────────────────────
       Trova la grid view di ExtJS (quella scrollabile)
    ────────────────────────────────────────────────────── */
    function getGrid() {
        return document.querySelector('.x-grid-view');
    }

    /* ──────────────────────────────────────────────────────
       Icone presa visione NON ancora confermate (rosse)
       che siano attualmente nel DOM (virtual scroll le
       aggiunge/rimuove in base alla posizione di scroll)
    ────────────────────────────────────────────────────── */
    function getPendingIcons() {
        return visible('span.icon-presa-visione').filter(
            el => !el.classList.contains('icon-presa-visione-check')
        );
    }

    /* ──────────────────────────────────────────────────────
       Cerca la prossima icona in sospeso.
       Se non ce ne sono in viewport, scrolla verso il basso
       di un passo alla volta finché ne trova una oppure
       raggiunge il fondo della grid (= finito).
    ────────────────────────────────────────────────────── */
    async function findNextPendingIcon() {
        const grid = getGrid();

        // Prima controlla ciò che è già visibile
        let icons = getPendingIcons();
        if (icons.length > 0) return icons[0];

        if (!grid) return null;

        // Scrolla in avanti finché ne trova una o raggiunge il fondo
        while (true) {
            if (shouldStop) return null;

            const before = grid.scrollTop;
            grid.scrollTop += CFG.scrollStep;
            await sleep(CFG.scrollStepDelay);

            icons = getPendingIcons();
            if (icons.length > 0) return icons[0];

            // Fondo raggiunto: scrollTop non cambia più
            if (grid.scrollTop === before) return null;
        }
    }

    /* ──────────────────────────────────────────────────────
       Dopo aver cliccato Indietro, la grid torna alla lista.
       ExtJS può aver fatto un piccolo re-render: aspettiamo
       che ricompaia almeno una riga nella grid.
    ────────────────────────────────────────────────────── */
    async function waitForGrid(maxWait = 4000) {
        const step = 300;
        let waited = 0;
        while (waited < maxWait) {
            if (document.querySelector('table[data-recordid]')) return true;
            await sleep(step);
            waited += step;
        }
        return false;
    }

    /* ──────────────────────────────────────────────────────
       Aspetta che il pannello allegati sia carico
    ────────────────────────────────────────────────────── */
    async function waitForAttachments(maxWait = 7000) {
        const step = 300;
        let waited = 0;
        while (waited < maxWait) {
            const links = visible('a[alt]').filter(a => {
                const alt = (a.getAttribute('alt') || '').trim();
                if (!alt) return false;

                const href = (a.getAttribute('href') || '').trim().toLowerCase();
                const inAttachmentGrid = !!a.closest('[id^="grigliaallegatiperdownloadview"], .x-grid');

                return inAttachmentGrid && (href === '#' || href.startsWith('javascript:'));
            });
            if (links.length > 0) return links;
            await sleep(step);
            waited += step;
        }
        return [];
    }

    function extClick(el) {
        if (!el) return;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        try { el.focus(); } catch(e) {}
        ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(type => {
            el.dispatchEvent(new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                view: window
            }));
        });
    }

    /* ──────────────────────────────────────────────────────
       Click allegato + chiusura automatica del tab aperto
    ────────────────────────────────────────────────────── */
    function clickAttachmentAndClose(linkEl) {
        return new Promise(resolve => {
            const originalOpen = window.open;
            let resolved = false;

            const finish = () => {
                window.open = originalOpen;
                if (!resolved) {
                    resolved = true;
                    setTimeout(resolve, CFG.delayAfterAttachClick + 300);
                }
            };

            window.open = function (url, target, features) {
                const newWin = originalOpen.call(window, url, target || '_blank', features);
                if (newWin) {
                    setTimeout(() => { try { newWin.close(); } catch(e) {} }, CFG.delayAfterAttachClick);
                }
                finish();
                return newWin;
            };

            extClick(linkEl);

            // Safety timeout: se ExtJS non usa window.open (es. download diretto)
            setTimeout(finish, CFG.delayAfterAttachClick + 2200);
        });
    }

    /* ──────────────────────────────────────────────────────
       Conferma Ok nel dialog
    ────────────────────────────────────────────────────── */
    async function clickOk() {
        await sleep(CFG.delayAfterPVClick);
        const span = visible('span.x-btn-inner').find(el =>
            ['ok', 'conferma'].includes(el.textContent.trim().toLowerCase())
        );
        if (span) {
            (span.closest('a') || span.closest('button') || span.parentElement).click();
            log('  ↳ Ok confermato', '#4ade80');
            await sleep(CFG.delayAfterOk);
            return true;
        }
        const link = visible('a').find(el =>
            el.textContent.trim().toLowerCase() === 'ok'
        );
        if (link) {
            link.click();
            log('  ↳ Ok confermato (link)', '#4ade80');
            await sleep(CFG.delayAfterOk);
            return true;
        }
        log('  ⚠ Dialog Ok non trovato', '#facc15');
        return false;
    }

    /* ══════════════════════════════════════════════════════
       CICLO PRINCIPALE
    ══════════════════════════════════════════════════════ */
    async function runPresaVisione() {
        running = true; shouldStop = false;
        startBtn.style.display = 'none';
        stopBtn.style.display  = 'block';
        logBox.style.display   = 'block';

        // Porta la grid all'inizio
        const grid = getGrid();
        if (grid) { grid.scrollTop = 0; await sleep(400); }

        log('▶ Avvio – scorrimento progressivo con virtual scroll', '#7dd3fc');

        let total = 0, guard = CFG.maxIterations;

        while (guard-- > 0 && !shouldStop) {

            /* ── trova la prossima icona, scrollando se serve ── */
            setStatus(`Cerco prossima circolare… (${total} fatte)`);
            const pvIcon = await findNextPendingIcon();

            if (!pvIcon) {
                log('✅ Nessuna altra circolare da processare!', '#4ade80');
                setStatus(`Completato – ${total} prese visione effettuate.`);
                break;
            }

            /* Descrizione */
            const rowTable = pvIcon.closest('table[data-recordid]');
            let desc = '?';
            if (rowTable) {
                const cells = rowTable.querySelectorAll('.x-grid-cell-inner');
                if (cells.length >= 4) desc = cells[3].textContent.trim().substring(0, 55);
            }
            log(`► "${desc}"`, '#e2e8f0');
            setStatus(`In corso: "${desc.substring(0,30)}…"`);

            /* STEP A – click icona File */
            const fileIcon = rowTable ? rowTable.querySelector('a.file-icon') : null;
            if (!fileIcon) {
                log('  ⚠ Nessuna icona File – PV diretta', '#facc15');
                pvIcon.click();
                await clickOk();
                total++;
                await sleep(CFG.delayBetweenRows);
                continue;
            }

            fileIcon.click();
            log('  [1] Click icona File', '#93c5fd');
            await sleep(CFG.delayAfterFileClick);

            /* STEP B – click allegato + chiudi tab */
            const attachLinks = await waitForAttachments();
            if (attachLinks.length === 0) {
                log('  ⚠ Nessun allegato trovato', '#facc15');
            } else {
                const fname = (attachLinks[0].getAttribute('alt') || attachLinks[0].textContent).trim();
                log(`  [2] Allegato: ${fname.substring(0, 50)}`, '#93c5fd');
                await clickAttachmentAndClose(attachLinks[0]);
                log('  [2b] Tab chiuso', '#93c5fd');
            }

            /* STEP C – click Indietro */
            if (clickButtonByText('Indietro')) {
                log('  [3] Click Indietro', '#93c5fd');
            } else {
                log('  ⚠ Indietro non trovato', '#facc15');
            }
            await sleep(CFG.delayAfterIndietro);
            await waitForGrid();

            /* STEP D – cerca di nuovo la stessa riga (ora è in viewport) */
            // Dopo Indietro ExtJS ripristina la posizione di scroll precedente,
            // quindi l'icona rossa della riga dovrebbe essere visibile.
            const newPending = getPendingIcons();
            if (newPending.length === 0) {
                // ExtJS ha scrollato altrove: cerca di nuovo
                const icon2 = await findNextPendingIcon();
                if (!icon2) {
                    log('  ℹ Nessuna PV rimasta – forse già confermata automaticamente', '#fbbf24');
                    total++;
                    await sleep(CFG.delayBetweenRows);
                    continue;
                }
                icon2.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                await sleep(200);
                icon2.click();
            } else {
                newPending[0].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                await sleep(200);
                newPending[0].click();
            }
            log('  [4] Click presa visione', '#93c5fd');

            /* STEP E – Ok */
            await clickOk();
            log('  ✓ Confermata!', '#4ade80');

            total++;
            await sleep(CFG.delayBetweenRows);
        }

        if (shouldStop) {
            log(`⏹ Fermato – ${total} fatte.`, '#fb923c');
            setStatus(`Fermato – ${total} prese visione effettuate.`);
        } else if (guard <= 0) {
            log('⚠ Limite iterazioni raggiunto.', '#facc15');
        }

        startBtn.style.display = 'block';
        stopBtn.style.display  = 'none';
        running = false;
    }

    startBtn.addEventListener('click', () => { if (!running) runPresaVisione(); });
    stopBtn.addEventListener ('click', () => { shouldStop = true; });

})();

