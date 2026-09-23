
// --- AUTHENTICATION ---
function checkAuth() {
    if (sessionStorage.getItem('suspension_auth') === 'true') {
        document.getElementById('loginScreen').classList.add('hidden');
    } else if (sessionStorage.getItem('suspension_readonly') === 'true') {
        document.getElementById('loginScreen').classList.add('hidden');
        document.body.classList.add('read-only');
    }
}
document.addEventListener("DOMContentLoaded", checkAuth);

function login() {
    const pw = document.getElementById('pwInput').value;
    if (pw === 'suspension') {
        sessionStorage.setItem('suspension_auth', 'true');
        sessionStorage.setItem('suspension_pw', pw);
        sessionStorage.removeItem('suspension_readonly');
        document.getElementById('loginScreen').classList.add('hidden');
        document.body.classList.remove('read-only');
        document.getElementById('loginError').style.display = 'none';
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
}

function continueReadOnly() {
    sessionStorage.setItem('suspension_readonly', 'true');
    sessionStorage.removeItem('suspension_auth');
    sessionStorage.removeItem('suspension_pw');
    document.getElementById('loginScreen').classList.add('hidden');
    document.body.classList.add('read-only');
    document.getElementById('loginError').style.display = 'none';
}

const SUPABASE_URL = 'https://dxxizztzvwnlwruxwmrw.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4eGl6enR6dndubHdydXh3bXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxODY1NjcsImV4cCI6MjEwNTc2MjU2N30.0-zKgzFWCqCXyhb7uCv1IGQtvzuWRoRrJ7ja6QbDCsQ';

function getAuthHeaders() {
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };
}

let bauteileData = [];
let bauteileColumns = [];
let lieferantenData = [];
let lieferantenColumns = [];
let normteileData = [];
let normteileColumns = [];

// Load target date from local storage or default
let savedDate = localStorage.getItem('suspension_target_date') || '2026-12-01';
let targetDate = new Date(savedDate);

// Set initial value in HTML
document.addEventListener("DOMContentLoaded", () => {
    let input = document.getElementById('targetDateInput');
    if (input) input.value = savedDate;
});

function updateTargetDate(newDateStr) {
    pushHistory();
    if (!newDateStr) return;
    targetDate = new Date(newDateStr);
    markDirty();
    localStorage.setItem('suspension_target_date', newDateStr);
    renderBauteile();
    updateDashboard();
}

// Tab Switching
function switchTab(tabId) {
    if (tabId === 'lieferanten' && sessionStorage.getItem('suspension_auth') !== 'true') {
        return;
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        let attr = btn.getAttribute('onclick') || '';
        if (attr.includes(tabId)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    let target = document.getElementById(tabId);
    if (target) target.classList.add('active');
    if (tabId === 'gantt' && typeof renderGanttChart === 'function') {
        renderGanttChart();
    }
    if (target) target.scrollTop = 0;
    let ca = document.querySelector('.content-area');
    if (ca) ca.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Fetch Data
async function loadData() {
    try {
        const bRes = await fetch(`${SUPABASE_URL}/bauteile?select=*`, { headers: getAuthHeaders() });
        bauteileData = await bRes.json();
        bauteileColumns = bauteileData.length > 0 ? Object.keys(bauteileData[0]).filter(k => k !== 'id') : ['Bauteil-Name', 'Baugruppe', 'Unterbaugruppe', 'Fertiger / Firma', 'Verantwortlich', 'Dringlichkeit', 'Status', 'Assembly Zeit', 'Montage Zeit', 'Fertigungsdauer', 'Kontrollzeit & Puffer', 'Notizen', 'Benötigte Normteile', 'Unterbaugruppen-Status'];
        
        const lRes = await fetch(`${SUPABASE_URL}/lieferanten?select=*`, { headers: getAuthHeaders() });
        lieferantenData = await lRes.json();
        lieferantenColumns = lieferantenData.length > 0 ? Object.keys(lieferantenData[0]).filter(k => k !== 'id') : ['Fertigungsverfahren', 'Firma (Fertiger)', 'Teile / Komponenten (ct8)', 'Email', 'Webseite', 'Notizen'];
        
        const nRes = await fetch(`${SUPABASE_URL}/normteile?select=*`, { headers: getAuthHeaders() });
        normteileData = await nRes.json();
        normteileColumns = normteileData.length > 0 ? Object.keys(normteileData[0]).filter(k => k !== 'id') : ['Normteil Name', 'Kategorie', 'Beschreibung / Norm', 'Shop Link', 'Bestand', 'Geprüft am (Datum)', 'Bestellte Stückzahl (Zahl)', 'Bestellt am (Datum)', 'Angekommen (Check)'];
        
        if(!bauteileColumns.includes('Unterbaugruppe')) {
            let index = bauteileColumns.indexOf('Baugruppe');
            if (index !== -1) {
                bauteileColumns.splice(index + 1, 0, 'Unterbaugruppe');
            } else {
                bauteileColumns.push('Unterbaugruppe');
            }
        }
        
        renderBauteile();
        renderLieferanten();
        renderNormteile();
        renderGanttChart();
        updateGlobalDaysLeft();
        updateDashboard();
    } catch (error) {
        console.error("Fehler beim Laden der Daten:", error);
    }
}

async function saveData() {
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Speichern...';
    hasUnsavedChanges = false;
    historyStack = [];
    updateUndoButton();
    saveBtn.style.backgroundColor = '';

    try {
    if (bauteileData.length === 0) {
        alert('Sicherheits-Stopp: Die Daten wurden nicht korrekt geladen. Speichern blockiert!');
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Speichern';
        return;
    }
        let cleanB = bauteileData.map(r => { let o={}; bauteileColumns.forEach(c => o[c]=r[c]||'');  return o; });
        await fetch(`${SUPABASE_URL}/bauteile?id=not.is.null`, { method: 'DELETE', headers: getAuthHeaders() });
        let r1 = await fetch(`${SUPABASE_URL}/bauteile`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(cleanB) });
        if (!r1.ok) throw new Error("Fehler beim Speichern der Bauteile");

        let cleanL = lieferantenData.map(r => { let o={}; lieferantenColumns.forEach(c => o[c]=r[c]||'');  return o; });
        await fetch(`${SUPABASE_URL}/lieferanten?id=not.is.null`, { method: 'DELETE', headers: getAuthHeaders() });
        let r2 = await fetch(`${SUPABASE_URL}/lieferanten`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(cleanL) });
        if (!r2.ok) throw new Error("Fehler beim Speichern der Lieferanten");

        let cleanN = normteileData.map(r => { let o={}; normteileColumns.forEach(c => o[c]=r[c]||'');  return o; });
        await fetch(`${SUPABASE_URL}/normteile?id=not.is.null`, { method: 'DELETE', headers: getAuthHeaders() });
        let r3 = await fetch(`${SUPABASE_URL}/normteile`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(cleanN) });
        if (!r3.ok) throw new Error("Fehler beim Speichern der Normteile");

        showToast();
    } catch (e) {
        console.error(e);
        alert("Speicherfehler: " + (e.message || "Unbekannter Fehler"));
    } finally {
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Speichern';
        loadData();
    }
}

function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function isStandardBCol(col) {
    return ['Baugruppe', 'Unterbaugruppe', 'Unterbaugruppen-Status', 'Bauteil-Name', 'Fertiger / Firma', 'Verantwortlich', 'Dringlichkeit', 'Status', 'Assembly Zeit', 'Montage Zeit', 'Fertigungsdauer', 'Kontrollzeit & Puffer', 'Notizen', 'Benötigte Normteile'].includes(col);
}
function calculateDates(row) {
    let assembly = parseInt(row["Assembly Zeit"]) || 0;
    let montage = parseInt(row["Montage Zeit"]) || 0;
    let fertigung = parseInt(row["Fertigungsdauer"]) || 0;
    let kontrolle = parseInt(row["Kontrollzeit & Puffer"]) || 0;
    
    // Lieferdatum (when it must arrive from manufacturer)
    let dLiefer = new Date(targetDate);
    dLiefer.setDate(dLiefer.getDate() - assembly - montage);
    
    // Abschickdatum (when CAD must be sent to manufacturer)
    let dAbschick = new Date(dLiefer);
    dAbschick.setDate(dAbschick.getDate() - fertigung);
    
    // Fertig zur Kontrolle (when CAD design must be finished for checking)
    let dKontrolle = new Date(dAbschick);
    dKontrolle.setDate(dKontrolle.getDate() - kontrolle);
    
    return { lieferdatum: dLiefer, abschickdatum: dAbschick, kontrolle: dKontrolle };
}

// Rendering
function renderBauteile() {
    const thead = document.getElementById('bauteileHead');
    const tbody = document.getElementById('bauteileBody');
    
    // Build Head
    let headHtml = '<tr>';
    bauteileColumns.forEach(col => {
        if (col === 'Assembly Zeit' || col === 'Montage Zeit' || col === 'Unterbaugruppen-Status') return;
        let sClass = col === 'Bauteil-Name' ? ' class="sticky-col-main"' : '';
        headHtml += `<th${sClass}>
            ${col}
            ${!isStandardBCol(col) ? ` <button class="delete-btn" style="padding:2px; font-size:10px" onclick="delBauteilColumn('${col}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </th>`;
        if (col === 'Kontrollzeit & Puffer') {
            headHtml += `<th>Fertig zur Kontrolle (CAD)</th>`;
            headHtml += `<th>Spät. Abschickdatum</th>`;
            headHtml += `<th>Spät. Lieferdatum</th>`;
        }
    });
    headHtml += `<th></th></tr>`;
    thead.innerHTML = headHtml;

    // Body
    tbody.innerHTML = '';
    const suppliers = lieferantenData.map(l => l["Firma (Fertiger)"]).filter(s => s && s.trim() !== "");
    
    // Populate Datalist for Baugruppen
    const uniqueGroups = [...new Set(bauteileData.map(b => b["Baugruppe"] || 'Sonstiges'))].sort();
    const datalist = document.getElementById('baugruppenList');
    if (datalist) datalist.innerHTML = uniqueGroups.map(g => `<option value="${g}">`).join('');
    
    // Sort Data visually by Baugruppe and then by Bauteil-Name
    let sortedData = [...bauteileData].map((row, index) => ({row, index})).sort((a,b) => {
        let gA = a.row["Baugruppe"] || 'Sonstiges';
        let gB = b.row["Baugruppe"] || 'Sonstiges';
        if (gA === 'Sonstiges' && gB !== 'Sonstiges') return 1;
        if (gB === 'Sonstiges' && gA !== 'Sonstiges') return -1;
        let cmp1 = gA.localeCompare(gB);
        if (cmp1 !== 0) return cmp1;

        let uA = a.row["Unterbaugruppe"] || 'Keine';
        let uB = b.row["Unterbaugruppe"] || 'Keine';
        let cmp2 = uA.localeCompare(uB);
        if (cmp2 !== 0) return cmp2;

        let nA = a.row["Bauteil-Name"] || '';
        let nB = b.row["Bauteil-Name"] || '';
        return nA.localeCompare(nB);
    });
    
    let currentGroup = null;
    let currentSubGroup = null;

    sortedData.forEach(({row, index}) => {
        let group = row["Baugruppe"] || 'Sonstiges';
        let subGroup = row["Unterbaugruppe"] || 'Keine';

        if (group !== currentGroup) {
            currentGroup = group;
            currentSubGroup = null; // force subgroup refresh
            // Inject Baugruppe Header
            const headerTr = document.createElement('tr');
            headerTr.className = 'group-header';
            headerTr.innerHTML = `<td colspan="100%"><div class="sticky-group-header"><i class="fa-solid fa-layer-group" style="margin-right:8px;"></i> ${currentGroup}</div></td>`;
            tbody.appendChild(headerTr);
        }

        if (subGroup !== currentSubGroup) {
            currentSubGroup = subGroup;
            let aZeit = row["Assembly Zeit"] || 0;
            let mZeit = row["Montage Zeit"] || 0;
            let uStatus = row["Unterbaugruppen-Status"] || 'Ausstehend';

            const uHeaderTr = document.createElement('tr');
            uHeaderTr.className = 'sub-group-header';
            uHeaderTr.style.backgroundColor = 'var(--bg-main)';
            uHeaderTr.innerHTML = `<td colspan="100%"><div class="sticky-sub-group-header" style="display:inline-flex; align-items:center; gap: 20px; padding-left: 20px; border-bottom: 1px solid var(--border); padding-top:5px; padding-bottom:5px;">
                <span style="font-weight:600; font-size:0.9rem; color:var(--text-main);"><i class="fa-solid fa-folder-tree" style="margin-right:5px; color:var(--primary);"></i> ${currentSubGroup}</span>
                <div style="font-size:0.8rem; font-weight:normal; display:flex; align-items:center; gap:5px;">Assembly Zeit: <input type="number" value="${aZeit}" style="width:50px; padding:2px; font-size:0.8rem; border-radius:4px; border:1px solid var(--border); background:var(--surface); color:var(--text-main);" oninput="updateUnterbaugruppe('${currentGroup}', '${currentSubGroup}', 'Assembly Zeit', this.value)"></div>
                <div style="font-size:0.8rem; font-weight:normal; display:flex; align-items:center; gap:5px;">Montage Zeit: <input type="number" value="${mZeit}" style="width:50px; padding:2px; font-size:0.8rem; border-radius:4px; border:1px solid var(--border); background:var(--surface); color:var(--text-main);" oninput="updateUnterbaugruppe('${currentGroup}', '${currentSubGroup}', 'Montage Zeit', this.value)"></div>
                <div style="font-size:0.8rem; font-weight:normal; display:flex; align-items:center; gap:5px;">Status: 
                    <select style="padding:2px; font-size:0.8rem; border-radius:4px; border:1px solid var(--border); background:var(--surface); color:var(--text-main);" onchange="updateUnterbaugruppe('${currentGroup}', '${currentSubGroup}', 'Unterbaugruppen-Status', this.value)">
                        <option value="Ausstehend" ${uStatus==='Ausstehend'?'selected':''}>Ausstehend</option>
                        <option value="Im Lager" ${uStatus==='Im Lager'?'selected':''}>Im Lager</option>
                        <option value="Assembled" ${uStatus==='Assembled'?'selected':''}>Assembled</option>
                        <option value="Montiert" ${uStatus==='Montiert'?'selected':''}>Montiert</option>
                    </select>
                </div>
            </div></td>`;
            tbody.appendChild(uHeaderTr);
        }

        const tr = document.createElement('tr');
        let html = '';
        
        bauteileColumns.forEach(col => {
            if (col === 'Assembly Zeit' || col === 'Montage Zeit' || col === 'Unterbaugruppen-Status') return;
            let val = row[col] || '';
            if (col === 'Fertiger / Firma') {
                let groupedSuppliers = {};
                lieferantenData.forEach(l => {
                    let vf = l["Fertigungsverfahren"] || 'Sonstiges';
                    let name = l["Firma (Fertiger)"];
                    if (name && name.trim() !== "") {
                        if (!groupedSuppliers[vf]) groupedSuppliers[vf] = [];
                        groupedSuppliers[vf].push(name);
                    }
                });
                
                let opts = `<option value="">- Kein Fertiger -</option>`;
                let sortedVf = Object.keys(groupedSuppliers).sort();
                sortedVf.forEach(vf => {
                    opts += `<optgroup label="${vf}">`;
                    let sortedNames = groupedSuppliers[vf].sort();
                    sortedNames.forEach(s => {
                        opts += `<option value="${s}" ${val === s ? 'selected' : ''}>${s}</option>`;
                    });
                    opts += `</optgroup>`;
                });
                
                opts += `<option value="ADD_NEW">+ Neuen Fertiger hinzufügen...</option>`;
                
                html += `<td><select onchange="if(this.value==='ADD_NEW'){ this.value='${val}'; openAddLieferantModal(); } else { updateB(${index}, '${col}', this.value); }">${opts}</select></td>`;
            } else if (col === 'Dringlichkeit') {
                let c = val === 'Hoch' ? 'badge-hoch' : val === 'Mittel' ? 'badge-mittel' : 'badge-niedrig';
                html += `<td><select class="badge-status ${c}" onchange="updateB(${index}, '${col}', this.value); renderBauteile();">
                    <option value="Hoch" ${val==='Hoch'?'selected':''}>Hoch</option>
                    <option value="Mittel" ${val==='Mittel'?'selected':''}>Mittel</option>
                    <option value="Niedrig" ${val==='Niedrig'?'selected':''}>Niedrig</option>
                </select></td>`;
            } else if (col === 'Status') {
                let c = 'badge-hoch';
                if(['Assembled', 'Fertig montiert'].includes(val)) c = 'badge-niedrig';
                else if(['In Fertigung', 'In Lieferung', 'Im Lager'].includes(val)) c = 'badge-mittel';
                html += `<td><select class="badge-status ${c}" onchange="updateB(${index}, '${col}', this.value); renderBauteile();">
                    <option value="Nicht begonnen" ${val==='Nicht begonnen'?'selected':''}>Nicht begonnen</option>
                    <option value="Designing" ${val==='Designing'?'selected':''}>Designing</option>
                    <option value="Fertigungszeichnung" ${val==='Fertigungszeichnung'?'selected':''}>Fertigungszeichnung</option>
                    <option value="Kontrolle" ${val==='Kontrolle'?'selected':''}>Kontrolle</option>
                    <option value="In Fertigung" ${val==='In Fertigung'?'selected':''}>In Fertigung</option>
                    <option value="In Lieferung" ${val==='In Lieferung'?'selected':''}>In Lieferung</option>
                    <option value="Im Lager" ${val==='Im Lager'?'selected':''}>Im Lager</option>
                    <option value="Assembled" ${val==='Assembled'?'selected':''}>Assembled</option>
                    <option value="Fertig montiert" ${val==='Fertig montiert'?'selected':''}>Fertig montiert</option>
                </select></td>`;
            } else if (col === 'Assembly Zeit' || col === 'Montage Zeit' || col === 'Fertigungsdauer' || col === 'Kontrollzeit & Puffer') {
                html += `<td><input type="number" value="${val}" onchange="updateB(${index}, '${col}', this.value); renderBauteile();"></td>`;
            } else if (col === 'Benötigte Normteile') {
                let count = 0;
                try { count = JSON.parse(val || '[]').length; } catch(e){}
                html += `<td><button class="add-btn" onclick="openModal(${index})" style="width:100%; white-space:nowrap;"><i class="fa-solid fa-nut"></i> ${count} Typen</button></td>`;
            } else if (col === 'Baugruppe') {
                html += `<td><input type="text" list="baugruppenList" value="${val}" onchange="updateB(${index}, '${col}', this.value); renderBauteile();"></td>`;
            } else if (col === 'Unterbaugruppe') {
                let mw = 'min-width: 150px;';
                html += `<td><input type="text" list="unterbaugruppenList" style="${mw}" value="${val}" onfocus="updateSubGroupSuggestionsForTable(${index})" onchange="updateB(${index}, '${col}', this.value); renderBauteile();"></td>`;
            } else if (col.toLowerCase().includes('(check)')) {
                let isChecked = val === 'true' || val === true || val === 'Ja' || val === '1';
                html += `<td style="text-align:center;"><input type="checkbox" ${isChecked ? 'checked' : ''} onchange="updateB(${index}, '${col}', this.checked ? 'true' : 'false'); renderBauteile();" style="width:20px; height:20px; cursor:pointer;"></td>`;
            } else {
                let type = 'text';
                let isTextarea = false;
                let lowerCol = col.toLowerCase();
                
                if (lowerCol.includes('(datum)') || lowerCol.includes('date')) type = 'date';
                else if (lowerCol.includes('(zahl)') || lowerCol === 'bestand') type = 'number';
                
                if (lowerCol.includes('(langtext)') || lowerCol.includes('notiz') || lowerCol.includes('beschreibung') || lowerCol.includes('text') || lowerCol.includes('info') || lowerCol.includes('link')) {
                    isTextarea = true;
                }

                if (isTextarea) {
                    html += `<td><textarea rows="1" onchange="updateB(${index}, '${col}', this.value)" ondblclick="openTextModal('bauteile', ${index}, '${col}')">${val}</textarea></td>`;
                } else {
                    let mw = col === 'Bauteil-Name' ? 'min-width: 250px;' : '';
                    let sClass = col === 'Bauteil-Name' ? ' class="sticky-col-main"' : '';
                    html += `<td${sClass}><input type="${type}" style="${mw}" value="${val}" onchange="updateB(${index}, '${col}', this.value)" ondblclick="if(this.type==='text') openTextModal('bauteile', ${index}, '${col}')"></td>`;
                }
            }
            
            if (col === 'Kontrollzeit & Puffer') {
                let dates = calculateDates(row);
                html += `<td id="date-kontrolle-${index}" class="readonly" style="color:var(--warning)">${dates.kontrolle.toLocaleDateString('de-DE')}</td>`;
                html += `<td id="date-abschick-${index}" class="readonly" style="color:var(--danger)">${dates.abschickdatum.toLocaleDateString('de-DE')}</td>`;
                html += `<td id="date-liefer-${index}" class="readonly">${dates.lieferdatum.toLocaleDateString('de-DE')}</td>`;
            }
        });
        
        html += `<td><button class="delete-btn" onclick="delB(${index})"><i class="fa-solid fa-trash"></i></button></td>`;
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

function isStandardLCol(col) {
    return ['Fertigungsverfahren', 'Firma (Fertiger)', 'Teile / Komponenten (ct8)', 'Email', 'Webseite', 'Notizen', 'Kontakt & Notizen'].includes(col);
}

function renderLieferanten() {
    const thead = document.getElementById('lieferantenHead');
    const tbody = document.getElementById('lieferantenBody');
    
    // Head
    let headHtml = '<tr>';
    lieferantenColumns.forEach(col => {
        let sStyle = col === 'Teile / Komponenten (ct8)' ? ' style="min-width: 250px;"' : '';
        headHtml += `<th${sStyle}>
            ${col}
            ${!isStandardLCol(col) ? ` <button class="delete-btn" style="padding:2px; font-size:10px" onclick="delLieferantColumn('${col}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </th>`;
        if (col === 'Teile / Komponenten (ct8)') {
            headHtml += `<th style="min-width: 250px;">Aktuelle Zuordnung der Teile</th>`;
        }
    });
    headHtml += `<th></th></tr>`;
    thead.innerHTML = headHtml;

    // Body
    tbody.innerHTML = '';
    lieferantenData.forEach((row, index) => {
        const tr = document.createElement('tr');
        let html = '';
        lieferantenColumns.forEach(col => {
            let val = row[col] || '';
            if (col === 'Firma (Fertiger)') {
                html += `<td><input type="text" value="${val}" onchange="updateL(${index}, '${col}', this.value); renderBauteile(); renderLieferanten();"></td>`;
                        } else if (col.toLowerCase().includes('(check)')) {
                let isChecked = val === 'true' || val === true || val === 'Ja' || val === '1';
                html += `<td style="text-align:center;"><input type="checkbox" ${isChecked ? 'checked' : ''} onchange="updateL(${index}, '${col}', this.checked ? 'true' : 'false'); renderLieferanten();" style="width:20px; height:20px; cursor:pointer;"></td>`;
            } else {
                let type = 'text';
                let isTextarea = false;
                let lowerCol = col.toLowerCase();
                
                if (lowerCol.includes('(datum)') || lowerCol.includes('date')) type = 'date';
                else if (lowerCol.includes('(zahl)') || lowerCol === 'bestand') type = 'number';
                
                if (lowerCol.includes('(langtext)') || lowerCol.includes('notiz') || lowerCol.includes('beschreibung') || lowerCol.includes('text') || lowerCol.includes('info') || lowerCol.includes('link')) {
                    isTextarea = true;
                }

                if (isTextarea) {
                    html += `<td><textarea rows="1" onchange="updateL(${index}, '${col}', this.value)" ondblclick="openTextModal('lieferanten', ${index}, '${col}')">${val}</textarea></td>`;
                } else {
                    let sClass = col === "Firma (Fertiger)" ? ' class="sticky-col-main"' : "";
                    html += `<td${sClass}><input type="${type}" value="${val}" onchange="updateL(${index}, '${col}', this.value)" ondblclick="if(this.type==='text') openTextModal('lieferanten', ${index}, '${col}')"></td>`;
                }
            }
            
            if (col === 'Teile / Komponenten (ct8)') {
                let assigned = bauteileData
                    .filter(b => b["Fertiger / Firma"] === row["Firma (Fertiger)"] && row["Firma (Fertiger)"].trim() !== "")
                    .map(b => b["Bauteil-Name"])
                    .filter(n => n && n.trim() !== "")
                    .join(", ");
                html += `<td class="calculated-list">${assigned}</td>`;
            }
        });
        html += `<td><button class="delete-btn" onclick="delL(${index})"><i class="fa-solid fa-trash"></i></button></td>`;
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

// Dashboard Logic
function updateDashboard() {
    const totalParts = bauteileData.length;
    if (totalParts === 0) return;

    // 1. Progress
    const erledigt = bauteileData.filter(b => ['Assembled', 'Fertig montiert'].includes(b["Status"])).length;
    const percent = Math.round((erledigt / totalParts) * 100);

    document.getElementById('progressPercent').innerText = percent || 0;
    document.getElementById('progressBar').style.width = (percent || 0) + '%';
    document.getElementById('progressDetails').innerText = `${erledigt} von ${totalParts} Bauteilen`;

    // 2. Status Breakdown
    const allStatuses = ['Nicht begonnen', 'Designing', 'Fertigungszeichnung', 'Kontrolle', 'In Fertigung', 'In Lieferung', 'Im Lager', 'Assembled', 'Fertig montiert'];
    let statHtml = '';

    allStatuses.forEach(s => {
        let count = bauteileData.filter(b => b["Status"] === s).length;
        let cClass = 'status-nicht'; 
        if (['Assembled', 'Fertig montiert'].includes(s)) cClass = 'status-erl'; 
        else if (['In Fertigung', 'In Lieferung', 'Im Lager'].includes(s)) cClass = 'status-fert'; 

        statHtml += `
            <div class="status-item ${cClass}">
                <span>${s}</span>
                <strong>${count}</strong>
            </div>
        `;
    });

    document.getElementById('statusList').innerHTML = statHtml;

    // 3. Critical 4 Weeks (Designing)
    const today = new Date();
    const fourWeeks = new Date();
    fourWeeks.setDate(today.getDate() + 28);

    let criticalDesignHtml = '';
    let designCount = 0;

    let partsWithDates = bauteileData.map(b => {
        let dates = calculateDates(b);
        return { ...b, dates };
    }).sort((a,b) => a.dates.kontrolle - b.dates.kontrolle);

    let activeParts = partsWithDates.filter(p => ['Nicht begonnen', 'Designing', 'Fertigungszeichnung', 'Kontrolle'].includes(p["Status"]));

    activeParts.forEach((part) => {
        let dKontrolle = part.dates.kontrolle;
        let within4Weeks = (dKontrolle >= today && dKontrolle <= fourWeeks) || (dKontrolle < today);

        if (designCount < 15 || within4Weeks) {
            designCount++;
            let isAlarm = (dKontrolle < today);
            let cDateStr = dKontrolle < today ? `<span style="color:var(--danger);font-weight:bold">${dKontrolle.toLocaleDateString('de-DE')} (Überfällig)</span>` : dKontrolle.toLocaleDateString('de-DE');
            let rowStyle = isAlarm ? ` style="background-color: rgba(239, 68, 68, 0.15);"` : ``;
            let nameStyle = isAlarm ? ` style="color: var(--danger);"` : ``;

            criticalDesignHtml += `
                <tr${rowStyle}>
                    <td${nameStyle}><strong>${part["Bauteil-Name"] || 'Unbenannt'}</strong></td>
                    <td>${part["Status"]}</td>
                    <td>${cDateStr}</td>
                </tr>
            `;
        }
    });

    // 4. Unterbaugruppen Logic (Wartet auf Teile, Building & Assemblying, Zur Montage ready)
    let ugs = {};
    const todayNoTime = new Date();
    todayNoTime.setHours(0,0,0,0);
    const targetNoTime = new Date(targetDate);
    targetNoTime.setHours(0,0,0,0);
    const daysLeftGlobal = Math.ceil((targetNoTime - todayNoTime) / (1000 * 60 * 60 * 24));

    bauteileData.forEach(p => {
        let ub = p["Unterbaugruppe"] || 'Keine';
        if (ub === 'Keine') return;
        
        let bg = p["Baugruppe"] || 'Sonstiges';
        let key = bg + "||" + ub;
        if (!ugs[key]) {
            ugs[key] = { 
                name: ub, baugruppe: bg, parts: [], missingNames: [], status: p["Unterbaugruppen-Status"] || 'Ausstehend',
                maxW: 0, minPW: 999999, // Wartet (Ass + Mon)
                maxA: 0, minPA: 999999, // Assembly (Ass)
                maxM: 0, minPM: 999999  // Montage (Mon)
            };
        }
        ugs[key].parts.push(p);
        
        let assembly = parseInt(p["Assembly Zeit"]) || 0;
        let montage = parseInt(p["Montage Zeit"]) || 0;
        
        let reqW = assembly + montage;
        if (reqW > ugs[key].maxW) ugs[key].maxW = reqW;
        let pW = daysLeftGlobal - reqW;
        if (pW < ugs[key].minPW) ugs[key].minPW = pW;
        
        let reqA = assembly;
        if (reqA > ugs[key].maxA) ugs[key].maxA = reqA;
        let pA = daysLeftGlobal - reqA;
        if (pA < ugs[key].minPA) ugs[key].minPA = pA;

        let reqM = montage;
        if (reqM > ugs[key].maxM) ugs[key].maxM = reqM;
        let pM = daysLeftGlobal - reqM;
        if (pM < ugs[key].minPM) ugs[key].minPM = pM;

        let okStatuses = ['Im Lager', 'Assembled', 'Fertig montiert'];
        if (!okStatuses.includes(p["Status"])) {
            ugs[key].missingNames.push(p["Bauteil-Name"]);
        }
    });

    let waitingHtml = '';
    let buildingHtml = '';
    let readyHtml = '';

    // Create an array so we can sort them, but the sorting depends on which table they fall into.
    // We will separate them first, then sort each group.
    
    let listWaiting = [];
    let listBuilding = [];
    let listReady = [];

    Object.values(ugs).forEach(ug => {
        let allImLager = ug.missingNames.length === 0;
        if (!allImLager) {
            listWaiting.push(ug);
        } else {
            if (ug.status === 'Assembled' || ug.status === 'Montiert') {
                listReady.push(ug);
            } else {
                listBuilding.push(ug);
            }
        }
    });

    listWaiting.sort((a,b) => a.minPW - b.minPW).forEach(ug => {
        let missingStr = ug.missingNames.join(', ');
        let pText = ug.minPW < 0 ? `<span style="color:var(--danger);font-weight:bold;">${ug.minPW} T</span>` : `<span style="color:var(--success);">${ug.minPW} T</span>`;
        waitingHtml += `
            <tr>
                <td><strong>${ug.name}</strong><br><span style="font-size:0.75rem;color:var(--text-muted);">${ug.baugruppe}</span></td>
                <td style="color:var(--danger); font-size:0.8rem;">Fehlt: ${missingStr}</td>
                <td><span>${daysLeftGlobal} T</span></td>
                <td><span>${ug.maxW} T</span></td>
                <td>${pText}</td>
            </tr>
        `;
    });

    listBuilding.sort((a,b) => a.minPA - b.minPA).forEach(ug => {
        let pText = ug.minPA < 0 ? `<span style="color:var(--danger);font-weight:bold;">${ug.minPA} T</span>` : `<span style="color:var(--success);">${ug.minPA} T</span>`;
        buildingHtml += `
            <tr>
                <td><strong>${ug.name}</strong><br><span style="font-size:0.75rem;color:var(--text-muted);">${ug.baugruppe}</span></td>
                <td><span style="color:var(--warning); font-size:0.75rem; border:1px solid var(--warning); padding:2px 5px; border-radius:4px;">Ready to Build</span></td>
                <td><span>${daysLeftGlobal} T</span></td>
                <td><span>${ug.maxA} T</span></td>
                <td>${pText}</td>
            </tr>
        `;
    });

    listReady.sort((a,b) => a.minPM - b.minPM).forEach(ug => {
        let badge = ug.status === 'Montiert' ? `<span style="color:var(--success); font-size:0.75rem; border:1px solid var(--success); padding:2px 5px; border-radius:4px;">Montiert</span>` : `<span style="color:var(--primary); font-size:0.75rem; border:1px solid var(--primary); padding:2px 5px; border-radius:4px;">Assembled</span>`;
        let pText = ug.minPM < 0 ? `<span style="color:var(--danger);font-weight:bold;">${ug.minPM} T</span>` : `<span style="color:var(--success);">${ug.minPM} T</span>`;
        readyHtml += `
            <tr>
                <td><strong>${ug.name}</strong><br><span style="font-size:0.75rem;color:var(--text-muted);">${ug.baugruppe}</span></td>
                <td>${badge}</td>
                <td><span>${daysLeftGlobal} T</span></td>
                <td><span>${ug.maxM} T</span></td>
                <td>${pText}</td>
            </tr>
        `;
    });

    // Add individual parts in Eigenfertigung (treated as Building & Assemblying -> uses only Assembly Zeit)
    let eigenParts = [];
    bauteileData.forEach(p => {
        let f = (p["Fertiger / Firma"] || '').toLowerCase();
        if (p["Status"] === 'In Fertigung' && (f.includes('eigen') || f === 'fsae' || f === 'munic')) {
            let assembly = parseInt(p["Assembly Zeit"]) || 0;
            let requiredTime = assembly;
            let puffer = daysLeftGlobal - requiredTime;
            eigenParts.push({p, puffer, requiredTime});
        }
    });
    
    eigenParts.sort((a,b) => a.puffer - b.puffer).forEach(item => {
        let p = item.p;
        let pText = item.puffer < 0 ? `<span style="color:var(--danger);font-weight:bold;">${item.puffer} T</span>` : `<span style="color:var(--success);">${item.puffer} T</span>`;
        buildingHtml += `
            <tr>
                <td><strong>${p["Bauteil-Name"]}</strong><br><span style="font-size:0.75rem;color:var(--text-muted);">${p["Baugruppe"]} (Eigen)</span></td>
                <td><span style="color:var(--warning); font-size:0.75rem; border:1px solid var(--warning); padding:2px 5px; border-radius:4px;">${p["Status"]}</span></td>
                <td><span>${daysLeftGlobal} T</span></td>
                <td><span>${item.requiredTime} T</span></td>
                <td>${pText}</td>
            </tr>
        `;
    });

    if(!criticalDesignHtml) criticalDesignHtml = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Keine anstehenden Designs</td></tr>';
    if(!waitingHtml) waitingHtml = '<tr><td colspan="2" style="text-align:center; color:var(--text-muted);">Keine Unterbaugruppen warten auf Teile</td></tr>';
    if(!buildingHtml) buildingHtml = '<tr><td colspan="2" style="text-align:center; color:var(--text-muted);">Keine Unterbaugruppen bereit zum Assembliing</td></tr>';
    if(!readyHtml) readyHtml = '<tr><td colspan="2" style="text-align:center; color:var(--text-muted);">Keine fertig assemblierten Unterbaugruppen</td></tr>';

    document.getElementById('criticalDesignBody').innerHTML = criticalDesignHtml;
    let wb = document.getElementById('waitingPartsBody');
    if (wb) wb.innerHTML = waitingHtml;
    let cb = document.getElementById('criticalBuildBody');
    if (cb) cb.innerHTML = buildingHtml;
    let rm = document.getElementById('readyMontageBody');
    if (rm) rm.innerHTML = readyHtml;

    // Critical number is now just design deadlines in next 4 weeks
    let critNum = activeParts.filter(p => {
        let d = p.dates.kontrolle;
        return (d >= today && d <= fourWeeks) || (d < today);
    }).length;
    document.getElementById('criticalNumber').innerHTML = `<span style="color:var(--danger)">${critNum} kritisch</span>`;

    // 5. Normteile Übersicht
    let nToOrder = 0;
    let nOrdered = 0;
    let nReady = 0;

    normteileData.forEach(row => {
        let nName = row['Normteil Name'];
        let nCat = row['Kategorie'];
        if (!nName || !nCat) return;

        let totalQty = 0;
        bauteileData.forEach(b => {
            try {
                let reqs = JSON.parse(b['Benötigte Normteile'] || '[]');
                reqs.forEach(r => {
                    if (r.name === nName && r.cat === nCat) {
                        totalQty += (parseInt(r.qty) || 1);
                    }
                });
            } catch(e) {}
        });

        if (totalQty === 0) return; // Ignore if not needed anywhere
        
        let stock = parseInt(row['Bestand']) || 0;
        let ordered = parseInt(row['Bestellte Stückzahl (Zahl)']) || 0;
        let arrived = row['Angekommen (Check)'] === 'true' || row['Angekommen (Check)'] === true || row['Angekommen (Check)'] === 'Ja' || row['Angekommen (Check)'] === '1';

        if (totalQty <= stock || (totalQty <= stock + ordered && arrived)) {
            nReady++;
        } else if (totalQty <= stock + ordered && !arrived) {
            nOrdered++;
        } else {
            nToOrder++;
        }
    });

    let eToOrder = document.getElementById('ntToOrder');
    if (eToOrder) eToOrder.innerText = nToOrder;
    let eOrdered = document.getElementById('ntOrdered');
    if (eOrdered) eOrdered.innerText = nOrdered;
    let eReady = document.getElementById('ntReady');
    if (eReady) eReady.innerText = nReady;

    if (typeof updateGanttFilters === 'function') updateGanttFilters();
    if (typeof renderGanttSummary === 'function') renderGanttSummary();
    if (document.getElementById('gantt') && document.getElementById('gantt').classList.contains('active') && typeof renderGanttChart === 'function') {
        renderGanttChart();
    }
}

// Updaters
function updateB(index, key, value) {
    pushHistory();
    bauteileData[index][key] = value;
    markDirty();
    if (key === 'Fertiger / Firma') {
        
renderLieferanten(); 
    }
    updateDashboard(); // Update home real-time
}

function updateL(index, key, value) {
    pushHistory();
    lieferantenData[index][key] = value;
    markDirty();
}

// Dynamic Columns
function addBauteilColumn() { openAddColumnModal('bauteile'); }

function delBauteilColumn(colName) {
    if (confirm(`Möchtest du die Spalte '${colName}' wirklich komplett löschen?`)) {
        pushHistory();
        bauteileColumns = bauteileColumns.filter(c => c !== colName);
        markDirty();
        bauteileData.forEach(row => { delete row[colName]; });
        renderBauteile();
    }
}

function addLieferantColumn() { openAddColumnModal('lieferanten'); }

function delLieferantColumn(colName) {
    if (confirm(`Möchtest du die Spalte '${colName}' wirklich komplett löschen?`)) {
        pushHistory();
        lieferantenColumns = lieferantenColumns.filter(c => c !== colName);
        markDirty();
        lieferantenData.forEach(row => { delete row[colName]; });
        
renderLieferanten();
    }
}

// Add Rows
function addBauteilRow() { openAddBauteilModal(); }

function addLieferantRow() { openAddLieferantModal(); }

window.openAddLieferantModal = function() {
    if (sessionStorage.getItem('suspension_readonly') === 'true') return;
    document.getElementById('addLieferantModal').style.display = '';
    document.getElementById('addLieferantModal').classList.add('show');
    document.getElementById('newLieferantVerfahrenInput').value = '';
    document.getElementById('newLieferantNameInput').value = '';
    document.getElementById('newLieferantEmailInput').value = '';
    document.getElementById('newLieferantWebInput').value = '';
    updateVerfahrenSuggestions();
};

window.closeAddLieferantModal = function() {
    try {
        document.getElementById('addLieferantModal').classList.remove('show');
    } catch(e) {}
};

window.saveAddLieferantModal = function() {
    try {
        let verfahren = document.getElementById('newLieferantVerfahrenInput').value.trim() || 'Sonstiges';
        let name = document.getElementById('newLieferantNameInput').value.trim();
        let email = document.getElementById('newLieferantEmailInput').value.trim();
        let web = document.getElementById('newLieferantWebInput').value.trim();
        
        if (!name) { alert("Bitte einen Firmennamen eingeben!"); return; }
        
        pushHistory();
        let newRow = {};
        lieferantenColumns.forEach(c => newRow[c] = "");
        newRow["Fertigungsverfahren"] = verfahren;
        newRow["Firma (Fertiger)"] = name;
        newRow["Email"] = email;
        newRow["Webseite"] = web;
        
        lieferantenData.push(newRow);
        markDirty();
        renderLieferanten();
        renderBauteile(); 
        closeAddLieferantModal();
    } catch(e) {
        alert("Error: " + e.message);
    }
};

window.updateVerfahrenSuggestions = function() {
    const list = document.getElementById('verfahrenList');
    if (!list) return;
    const unique = [...new Set(lieferantenData.map(l => l["Fertigungsverfahren"] || 'Sonstiges'))].sort();
    list.innerHTML = unique.map(v => `<option value="${v}">`).join('');
};

// Delete Rows
function delB(index) {
    if(confirm("Bauteil wirklich löschen?")) {
        pushHistory();
        bauteileData.splice(index, 1);
        markDirty();
        renderBauteile();
        
renderLieferanten();
        updateDashboard();
    }
}

function delL(index) {
    if(confirm("Lieferant wirklich löschen?")) {
        pushHistory();
        lieferantenData.splice(index, 1);
        markDirty();
        
renderLieferanten();
        renderBauteile();
    }
}

// Dirty State Management
let hasUnsavedChanges = false;



function markDirty() {
    hasUnsavedChanges = true;
    let saveBtn = document.getElementById('saveBtn');
    if (saveBtn && !saveBtn.innerHTML.includes('fa-spin')) {
        saveBtn.style.backgroundColor = 'var(--danger)'; // Highlight save button in red
    }
}

// Init
window.onload = loadData;


// --- NORMTEILE LOGIC ---
let currentBauteilIndex = null;
let currentModalData = [];

function openModal(index) {
    currentBauteilIndex = index;
    let jsonStr = bauteileData[index]['Benötigte Normteile'] || '[]';
    try { currentModalData = JSON.parse(jsonStr); } catch(e) { currentModalData = []; }
    if (!Array.isArray(currentModalData)) currentModalData = [];
    
    document.getElementById('modalTitle').innerText = 'Normteile verwalten: ' + (bauteileData[index]['Bauteil-Name'] || 'Unbenannt');
    renderModal();
    document.getElementById('normteileModal').classList.add('show');
}

function closeModal() {
    document.getElementById('normteileModal').classList.remove('show');
}

function saveModal() {
    pushHistory();
    bauteileData[currentBauteilIndex]['Benötigte Normteile'] = JSON.stringify(currentModalData);
    markDirty();
    closeModal();
    renderBauteile();
    renderNormteile();
    updateDashboard();
}


function renderModal() {
    const uniqueCats = [...new Set(normteileData.map(n => n['Kategorie']).filter(n=>n))].sort();
    let catListHtml = uniqueCats.map(c => `<option value="${c}">`).join('');

    const tbody = document.getElementById('modalNormteileBody');
    tbody.innerHTML = '';
    currentModalData.forEach((item, i) => {
        let currentCat = item.cat || '';
        let filteredNames = [...new Set(normteileData.filter(n => n['Kategorie'] === currentCat).map(n => n['Normteil Name']).filter(n=>n))].sort();
        let nameListHtml = filteredNames.map(n => `<option value="${n}">`).join('');
        
        tbody.innerHTML += `<tr>
            <td>
                <input type="text" list="catList_${i}" value="${currentCat}" placeholder="Gruppe..." onchange="updateModalItem(${i}, 'cat', this.value)">
                <datalist id="catList_${i}">${catListHtml}</datalist>
            </td>
            <td>
                <input type="text" list="nameList_${i}" value="${item.name || ''}" placeholder="Art..." onchange="updateModalItem(${i}, 'name', this.value)">
                <datalist id="nameList_${i}">${nameListHtml}</datalist>
            </td>
            <td><input type="number" min="1" value="${item.qty || 1}" onchange="updateModalItem(${i}, 'qty', this.value)" style="min-width:60px"></td>
            <td><button class="delete-btn" onclick="delModalRow(${i})"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });
}

function addModalRow() {
    currentModalData.push({cat: '', name: '', qty: 1});
    renderModal();
}

function updateModalItem(i, key, val) {
    currentModalData[i][key] = val;
    let cat = currentModalData[i].cat;
    let name = currentModalData[i].name;
    
    if (cat && name) {
        if (!normteileData.some(n => n['Kategorie'] === cat && n['Normteil Name'] === name)) {
            let nr = {};
            normteileColumns.forEach(c => nr[c] = '');
            nr['Kategorie'] = cat;
            nr['Normteil Name'] = name;
            normteileData.push(nr);
            renderNormteile();
        }
    }
    if (key === 'cat') renderModal();
}
function delModalRow(i) {
    currentModalData.splice(i, 1);
    renderModal();
}

function isStandardNCol(col) {
    return ['Normteil Name', 'Kategorie', 'Beschreibung / Norm', 'Shop Link'].includes(col);
}


function renderNormteile() {
    const thead = document.getElementById('normteileHead');
    const tbody = document.getElementById('normteileBody');
    
    let headHtml = '<tr>';
    normteileColumns.forEach(col => {
        let sClass = col === 'Normteil Name' ? ' class="sticky-col-main"' : '';
        if (col === 'Bestellte Stückzahl (Zahl)') {
            headHtml += `<th>Benötigt für (Gesamtanzahl)</th>`;
        }
        headHtml += `<th${sClass}>
            ${col}
            ${!isStandardNCol(col) ? ` <button class="delete-btn" style="padding:2px; font-size:10px" onclick="delNormteilColumn('${col}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </th>`;
    });
    if (!normteileColumns.includes('Bestellte Stückzahl (Zahl)')) {
            headHtml += `<th>Benötigt für (Gesamtanzahl)</th>`;
    }
    headHtml += `<th></th></tr>`;
    thead.innerHTML = headHtml;

    tbody.innerHTML = '';
    
    let sortedData = [...normteileData].map((row, index) => ({row, index})).sort((a,b) => {
        let gA = a.row["Kategorie"] || 'Sonstiges';
        let gB = b.row["Kategorie"] || 'Sonstiges';
        if (gA === 'Sonstiges' && gB !== 'Sonstiges') return 1;
        if (gB === 'Sonstiges' && gA !== 'Sonstiges') return -1;
        let cmp = gA.localeCompare(gB);
        if (cmp === 0) {
            let nA = a.row["Normteil Name"] || '';
            let nB = b.row["Normteil Name"] || '';
            return nA.localeCompare(nB);
        }
        return cmp;
    });
    
    let currentCat = null;
    sortedData.forEach(({row, index}) => {
        let cat = row["Kategorie"] || 'Sonstiges';
        if (cat !== currentCat) {
            currentCat = cat;
            const headerTr = document.createElement('tr');
            headerTr.className = 'group-header';
            headerTr.innerHTML = `<td colspan="100%"><div class="sticky-group-header"><i class="fa-solid fa-boxes-stacked"></i> ${currentCat}</div></td>`;
            tbody.appendChild(headerTr);
        }
    
        const tr = document.createElement('tr');
        let html = '';
        
        let nName = row['Normteil Name'];
        let nCat = row['Kategorie'];
        let usageStr = "";
        
        if (nName && nCat) {
            let totalQty = 0;
            let bauteileList = [];
            bauteileData.forEach(b => {
                try {
                    let reqs = JSON.parse(b['Benötigte Normteile'] || '[]');
                    reqs.forEach(r => {
                        if (r.name === nName && r.cat === nCat) {
                            let q = parseInt(r.qty) || 1;
                            totalQty += q;
                            bauteileList.push(`${b['Bauteil-Name'] || 'Unbenannt'} (${q}x)`);
                        }
                    });
                } catch(e) {}
            });
            if (totalQty > 0) {
                usageStr = `<strong>Gesamt: ${totalQty}x</strong><br><span style="font-size:0.8rem;color:var(--text-muted)">${bauteileList.join('<br>')}</span>`;
            }
        }
        
        normteileColumns.forEach(col => {
            let sClass = col === 'Normteil Name' ? ' class="sticky-col-main"' : '';
        if (col === 'Bestellte Stückzahl (Zahl)') {
                html += `<td>${usageStr}</td>`;
            }
        
            let val = row[col] || '';
            let type = 'text';
            let isTextarea = false;
            let lowerCol = col.toLowerCase();
            
            if (lowerCol.includes('(datum)') || lowerCol.includes('date')) type = 'date';
            else if (lowerCol.includes('(zahl)') || lowerCol === 'bestand') type = 'number';
            
            if (lowerCol.includes('(langtext)') || lowerCol.includes('notiz') || lowerCol.includes('beschreibung') || lowerCol.includes('text') || lowerCol.includes('info') || lowerCol.includes('link')) {
                isTextarea = true;
            }
            
            if (lowerCol.includes('(check)')) {
                let isChecked = val === 'true' || val === true || val === 'Ja' || val === '1';
                html += `<td${sClass} style="text-align:center;"><input type="checkbox" ${isChecked ? 'checked' : ''} onchange="updateN(${index}, '${col}', this.checked ? 'true' : 'false');" style="width:20px; height:20px; cursor:pointer;"></td>`;
            } else if (isTextarea) {
                html += `<td${sClass}><textarea rows="1" onchange="updateN(${index}, '${col}', this.value)" ondblclick="openTextModal('normteile', ${index}, '${col}')">${val}</textarea></td>`;
            } else {
                html += `<td${sClass}><input type="${type}" value="${val}" onchange="updateN(${index}, '${col}', this.value)" ondblclick="if(this.type==='text') openTextModal('normteile', ${index}, '${col}')"></td>`;
            }
        });
        
    if (!normteileColumns.includes('Bestellte Stückzahl (Zahl)')) {
            html += `<td>${usageStr}</td>`;
        }
        
        html += `<td><button class="delete-btn" onclick="delN(${index})"><i class="fa-solid fa-trash"></i></button></td>`;
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}
function openAddColumnModal(tableType) {
    if (sessionStorage.getItem('suspension_readonly') === 'true') return;
    document.getElementById('newColTableType').value = tableType;
    document.getElementById('newColNameInput').value = '';
    document.getElementById('newColTypeSelect').value = '';
    document.getElementById('addColumnModal').classList.add('show');
}

function closeAddColumnModal() {
    document.getElementById('addColumnModal').classList.remove('show');
}

function saveAddColumnModal() {
    let tableType = document.getElementById('newColTableType').value;
    let colName = document.getElementById('newColNameInput').value.trim();
    let colType = document.getElementById('newColTypeSelect').value;
    
    if (!colName) {
        alert("Bitte einen Spaltennamen eingeben!");
        return;
    }
    
    let finalColName = colName + (colType ? " " + colType : "");
    
    if (tableType === 'bauteile') {
        if (bauteileColumns.includes(finalColName)) { alert("Spalte existiert bereits!"); return; }
        pushHistory();
        bauteileColumns.push(finalColName);
        markDirty();
        bauteileData.forEach(row => { row[finalColName] = ""; });
        renderBauteile();
    } else if (tableType === 'lieferanten') {
        if (lieferantenColumns.includes(finalColName)) { alert("Spalte existiert bereits!"); return; }
        pushHistory();
        lieferantenColumns.push(finalColName);
        markDirty();
        lieferantenData.forEach(row => { row[finalColName] = ""; });
        renderLieferanten();
    } else if (tableType === 'normteile') {
        if (normteileColumns.includes(finalColName)) { alert("Spalte existiert bereits!"); return; }
        pushHistory();
        normteileColumns.push(finalColName);
        markDirty();
        normteileData.forEach(row => { row[finalColName] = ""; });
        renderNormteile();
    }
    closeAddColumnModal();
}


// --- ADD BAUTEIL MODAL ---
function openAddBauteilModal() {
    if (sessionStorage.getItem('suspension_readonly') === 'true') return;
    document.getElementById('newBauteilGroupInput').value = '';
    document.getElementById('newBauteilNameInput').value = '';
    document.getElementById('addBauteilModal').classList.add('show');
}


window.updateSubGroupSuggestionsForTable = function(index) {
    const uDatalist = document.getElementById('unterbaugruppenList');
    if (!uDatalist) return;
    
    let row = bauteileData[index];
    if (!row) return;
    let selectedBg = row["Baugruppe"] || 'Sonstiges';
    
    uDatalist.innerHTML = '';
    
    const uSet = new Set();
    bauteileData.forEach(r => {
        let g = r["Baugruppe"] || 'Sonstiges';
        let ug = r["Unterbaugruppe"] || 'Keine';
        if (g === selectedBg && ug !== 'Keine') {
            uSet.add(ug);
        }
    });
    
    uSet.forEach(ug => {
        let opt = document.createElement('option');
        opt.value = ug;
        uDatalist.appendChild(opt);
    });
};

window.updateSubGroupSuggestions = function() {
    const bgInput = document.getElementById('newBauteilGroupInput');
    const uDatalist = document.getElementById('unterbaugruppenList');
    if (!bgInput || !uDatalist) return;
    
    let selectedBg = bgInput.value.trim();
    uDatalist.innerHTML = '';
    
    const uSet = new Set();
    bauteileData.forEach(row => {
        let g = row["Baugruppe"] || 'Sonstiges';
        let ug = row["Unterbaugruppe"] || 'Keine';
        if (g === selectedBg && ug !== 'Keine') {
            uSet.add(ug);
        }
    });
    
    uSet.forEach(ug => {
        let opt = document.createElement('option');
        opt.value = ug;
        uDatalist.appendChild(opt);
    });
};

window.openAddBauteilModal = function() {
    document.getElementById('addBauteilModal').style.display = '';
    document.getElementById('addBauteilModal').classList.add('show');
    document.getElementById('newBauteilNameInput').value = '';
    document.getElementById('newBauteilGroupInput').value = '';
    document.getElementById('newBauteilSubGroupInput').value = '';
    // Reset suggestions
    updateSubGroupSuggestions();
};

function closeAddBauteilModal() {
    try {
        document.getElementById('addBauteilModal').style.display = '';
        document.getElementById('addBauteilModal').classList.remove('show');
    } catch (e) {
        console.error('Fehler beim Schließen des Bauteil‑Modals:', e);
    }
}

function saveAddBauteilModal() {
    try {
        let bg = document.getElementById('newBauteilGroupInput').value.trim() || 'Sonstiges';
        let name = document.getElementById('newBauteilNameInput').value.trim();
        
        let ubInput = document.getElementById('newBauteilSubGroupInput');
        let ub = (ubInput ? ubInput.value.trim() : '') || 'Keine';
        
        if (!name) { alert("Bitte einen Bauteil-Namen eingeben!"); return; }

        pushHistory();
        let newRow = {};
        bauteileColumns.forEach(c => newRow[c] = "");
        newRow["Baugruppe"] = bg;
        newRow["Unterbaugruppe"] = ub;
        newRow["Bauteil-Name"] = name;
        newRow["Dringlichkeit"] = "Mittel";
        newRow["Status"] = "Nicht begonnen";
        
        // Inherit times from existing subgroup if any
        let existing = bauteileData.find(r => (r["Baugruppe"]||'Sonstiges') === bg && (r["Unterbaugruppe"]||'Keine') === ub);
        newRow["Assembly Zeit"] = existing ? (existing["Assembly Zeit"] || "2") : "2";
        newRow["Montage Zeit"] = existing ? (existing["Montage Zeit"] || "0") : "0";
        newRow["Unterbaugruppen-Status"] = existing ? (existing["Unterbaugruppen-Status"] || "Ausstehend") : "Ausstehend";
        
        newRow["Fertigungsdauer"] = "14";
        newRow["Kontrolle (Tage)"] = "2";
        
        bauteileData.push(newRow);
        markDirty();
        renderBauteile();
        updateDashboard();
        closeAddBauteilModal();
    } catch(e) {
        alert("Fehler beim Hinzufügen:\n" + e.message + "\n" + e.stack);
    }
}


// --- UNDO LOGIC ---
let historyStack = [];

function pushHistory() {
    historyStack.push({
        b: JSON.parse(JSON.stringify(bauteileData)),
        l: JSON.parse(JSON.stringify(lieferantenData)),
        n: JSON.parse(JSON.stringify(normteileData)),
        bc: [...bauteileColumns],
        lc: [...lieferantenColumns],
        nc: [...normteileColumns]
    });
    if (historyStack.length > 30) historyStack.shift();
    updateUndoButton();
}

function updateUndoButton() {
    const btn = document.getElementById('undoBtn');
    if (!btn) return;
    if (historyStack.length > 0) {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
        btn.style.color = 'var(--text-main)';
        btn.innerText = `Rückgängig (${historyStack.length})`;
    } else {
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
        btn.style.color = 'var(--text-muted)';
        btn.innerHTML = `<i class="fa-solid fa-rotate-left"></i> Rückgängig`;
    }
}

function undo() {
    if (historyStack.length === 0) return;
    let lastState = historyStack.pop();
    bauteileData = lastState.b;
    lieferantenData = lastState.l;
    normteileData = lastState.n;
    bauteileColumns = lastState.bc;
    lieferantenColumns = lastState.lc;
    normteileColumns = lastState.nc;
    
    renderBauteile();
    renderLieferanten();
    renderNormteile();
    updateDashboard();
    updateUndoButton();
    markDirty(); // Reverting counts as an unsaved change relative to the server
    if (historyStack.length === 0) {
        // Technically it might be clean, but we leave it dirty unless we track server state exactly.
    }
}

// Search functionality
function filterBauteile() {
    let input = document.getElementById("bauteileSearch");
    let filter = input.value.toLowerCase();
    let tbody = document.getElementById("bauteileBody");
    if (!tbody) return;
    let trs = tbody.getElementsByTagName("tr");
    
    for (let i = 0; i < trs.length; i++) {
        let inputs = trs[i].getElementsByTagName("input");
        let selects = trs[i].getElementsByTagName("select");
        let textareas = trs[i].getElementsByTagName("textarea");
        let text = "";
        
        for (let j=0; j<inputs.length; j++) text += inputs[j].value.toLowerCase() + " ";
        for (let j=0; j<selects.length; j++) text += selects[j].value.toLowerCase() + " ";
        for (let j=0; j<textareas.length; j++) text += textareas[j].value.toLowerCase() + " ";
        
        if (text.indexOf(filter) > -1) {
            trs[i].style.display = "";
        } else {
            trs[i].style.display = "none";
        }
    }
}

// --- TEXT EDITOR MODAL ---
let currentTextType = null;
let currentTextIndex = null;
let currentTextCol = null;

function openTextModal(type, index, col) {
    if (sessionStorage.getItem('suspension_readonly') === 'true') return;
    currentTextType = type;
    currentTextIndex = index;
    currentTextCol = col;
    let val = '';
    if (type === 'bauteile') val = bauteileData[index][col] || '';
    else if (type === 'lieferanten') val = lieferantenData[index][col] || '';
    else if (type === 'normteile') val = normteileData[index][col] || '';
    
    document.getElementById('textModalTitle').innerText = col + ' bearbeiten';
    document.getElementById('largeTextEditor').value = val;
    document.getElementById('textModal').classList.add('show');
}

function closeTextModal() {
    document.getElementById('textModal').classList.remove('show');
}

function saveTextModal() {
    let val = document.getElementById('largeTextEditor').value;
    if (currentTextType === 'bauteile') { updateB(currentTextIndex, currentTextCol, val); renderBauteile(); }
    else if (currentTextType === 'lieferanten') { updateL(currentTextIndex, currentTextCol, val); renderLieferanten(); }
    else if (currentTextType === 'normteile') { updateN(currentTextIndex, currentTextCol, val); renderNormteile(); }
    closeTextModal();
}

function addNormteilRow() { openAddNormteilModal(); }

window.openAddNormteilModal = function() {
    if (sessionStorage.getItem('suspension_readonly') === 'true') return;
    document.getElementById('addNormteilModal').style.display = '';
    document.getElementById('addNormteilModal').classList.add('show');
    document.getElementById('newNormteilKatInput').value = '';
    document.getElementById('newNormteilNameInput').value = '';
    updateNormteilKatSuggestions();
};

window.closeAddNormteilModal = function() {
    try {
        document.getElementById('addNormteilModal').classList.remove('show');
    } catch(e) {}
};

window.saveAddNormteilModal = function() {
    try {
        let kat = document.getElementById('newNormteilKatInput').value.trim() || 'Sonstige';
        let name = document.getElementById('newNormteilNameInput').value.trim();
        
        if (!name) { alert("Bitte einen Normteilnamen eingeben!"); return; }
        
        pushHistory();
        let newRow = {};
        normteileColumns.forEach(c => newRow[c] = "");
        newRow["Kategorie"] = kat;
        newRow["Normteil Name"] = name;
        
        normteileData.push(newRow);
        markDirty();
        renderNormteile();
        closeAddNormteilModal();
    } catch(e) {
        alert("Error: " + e.message);
    }
};

window.updateNormteilKatSuggestions = function() {
    const list = document.getElementById('normteilKatList');
    if (!list) return;
    const unique = [...new Set(normteileData.map(n => n["Kategorie"] || 'Sonstige'))].sort();
    list.innerHTML = unique.map(v => `<option value="${v}">`).join('');
};

function addNormteilColumn() {
    openAddColumnModal('normteile');
}

function delNormteilColumn(colName) {
    if (confirm(`Möchtest du die Spalte '${colName}' wirklich komplett löschen?`)) {
        pushHistory();
        normteileColumns = normteileColumns.filter(c => c !== colName);
        markDirty();
        normteileData.forEach(row => { delete row[colName]; });
        renderNormteile();
    }
}

function delN(index) {
    if(confirm("Normteil wirklich löschen?")) {
        pushHistory();
        normteileData.splice(index, 1);
        markDirty();
        renderNormteile();
    }
}

window.updateUnterbaugruppe = function(baugruppe, unterbaugruppe, col, val) {
    bauteileData.forEach((row, idx) => {
        let g = row["Baugruppe"] || 'Sonstiges';
        let ug = row["Unterbaugruppe"] || 'Keine';
        if (g === baugruppe && ug === unterbaugruppe) {
            row[col] = val;
            let dates = calculateDates(row);
            let dK = document.getElementById('date-kontrolle-' + idx);
            let dA = document.getElementById('date-abschick-' + idx);
            let dL = document.getElementById('date-liefer-' + idx);
            if(dK) dK.innerHTML = dates.kontrolle < new Date() ? `<span style="color:var(--danger);font-weight:bold">${dates.kontrolle.toLocaleDateString('de-DE')} (Überfällig)</span>` : dates.kontrolle.toLocaleDateString('de-DE');
            if(dA) dA.innerText = dates.abschickdatum.toLocaleDateString('de-DE');
            if(dL) dL.innerText = dates.lieferdatum.toLocaleDateString('de-DE');
        }
    });
    markDirty();
    updateDashboard();
};


// --- GANTT DIAGRAMM LOGIK ---
window.updateGanttFilters = function() {
    let select = document.getElementById('ganttGroupFilter');
    if (!select) return;
    let currentVal = select.value || 'ALL';
    const uniqueGroups = [...new Set(bauteileData.map(b => b["Baugruppe"] || 'Sonstiges'))].sort();
    let html = '<option value="ALL">Alle Baugruppen</option>';
    uniqueGroups.forEach(g => {
        html += `<option value="${g}" ${g === currentVal ? 'selected' : ''}>${g}</option>`;
    });
    select.innerHTML = html;
};

window.renderGanttSummary = function() {
    let container = document.getElementById('ganttSummaryContainer');
    if (!container || bauteileData.length === 0) return;
    
    // Pick top 6 parts sorted by earliest design deadline
    let sorted = [...bauteileData].map(b => {
        let dates = b.dates || calculateDates(b);
        return { ...b, dates };
    }).sort((a, b) => a.dates.kontrolle - b.dates.kontrolle).slice(0, 20);

    let today = new Date();
    today.setHours(0,0,0,0);
    let target = new Date(targetDate);
    target.setHours(0,0,0,0);
    
    let totalSpan = Math.max(1, target - today);

    let html = `<table class="gantt-table" style="margin-top: 5px;">
        <thead>
            <tr>
                <th class="gantt-left-col" style="width: 240px; min-width: 240px; max-width: 240px; background: #0f172a !important;">Kritische Bauteile (Top 20)</th>
                <th style="width: 100%; text-align: left; padding-left: 15px; color: #cbd5e1;">Zeitstrahl (Heute <i class="fa-solid fa-arrow-right" style="font-size: 0.7rem;"></i> Rolling Chassis Target: ${target.toLocaleDateString('de-DE')})</th>
            </tr>
        </thead>
        <tbody>`;

    sorted.forEach(p => {
        let name = p["Bauteil-Name"] || 'Unbenannt';
        let bg = p["Baugruppe"] || 'Sonstiges';
        let dK = p.dates.kontrolle;
        let dA = p.dates.abschickdatum;
        let dL = p.dates.lieferdatum;
        
        let startCAD = Math.max(0, Math.min(100, ((dK - today) / totalSpan) * 100));
        let endCAD = Math.max(0, Math.min(100, ((dA - today) / totalSpan) * 100));
        let endFert = Math.max(0, Math.min(100, ((dL - today) / totalSpan) * 100));
        let endAss = Math.max(0, Math.min(100, ((target - today) / totalSpan) * 100));
        
        let wCAD = Math.max(2, endCAD - startCAD);
        let wFert = Math.max(2, endFert - endCAD);
        let wAss = Math.max(2, endAss - endFert);

        html += `<tr>
            <td class="gantt-left-col" style="width: 240px; min-width: 240px; max-width: 240px;">
                <div style="font-size: 0.7rem; color: #94a3b8; font-weight: 600;">${bg}</div>
                <div style="font-weight: 700; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${name}">${name}</div>
            </td>
            <td class="gantt-time-cell" style="padding: 6px 12px !important;">
                <div style="position: relative; width: 100%; height: 26px; background: rgba(0,0,0,0.25); border-radius: 6px; overflow: hidden; display: flex; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="width: ${startCAD}%; background: transparent;"></div>
                    <div class="gantt-seg-kontrolle" style="width: ${wCAD}%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; color: white; font-weight: bold; border-radius: 4px;" title="Kontrolle bis ${dA.toLocaleDateString('de-DE')}">K</div>
                    <div class="gantt-seg-fertigung" style="width: ${wFert}%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; color: white; font-weight: bold; border-radius: 4px;" title="Fertigung bis ${dL.toLocaleDateString('de-DE')}">Fertigung</div>
                    <div class="gantt-seg-assembly" style="width: ${wAss}%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; color: white; font-weight: bold; border-radius: 4px;" title="Montage bis ${target.toLocaleDateString('de-DE')}">Ass</div>
                </div>
            </td>
        </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
};

function getWeekNum(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return weekNo;
}

window.renderGanttChart = function() {
    let container = document.getElementById('ganttChartContainer');
    if (!container) return;
    
    let filterGroup = (document.getElementById('ganttGroupFilter') || {}).value || 'ALL';
    let viewScale = (document.getElementById('ganttViewScale') || {}).value || 'weeks';
    
    let filtered = bauteileData.filter(b => filterGroup === 'ALL' || (b["Baugruppe"] || 'Sonstiges') === filterGroup);
    if (filtered.length === 0) {
        container.innerHTML = '<div style="padding: 30px; text-align: center; color: #94a3b8;">Keine Bauteile gefunden</div>';
        return;
    }

    let today = new Date();
    today.setHours(0,0,0,0);
    let target = new Date(targetDate);
    target.setHours(0,0,0,0);

    // Find min and max date
    let minDate = new Date(today);
    minDate.setDate(minDate.getDate() - 7); // Start 1 week before today
    let maxDate = new Date(target);
    maxDate.setDate(maxDate.getDate() + 7);

    filtered.forEach(b => {
        let dates = b.dates || calculateDates(b);
        let cadStart = new Date(dates.kontrolle);
        cadStart.setDate(cadStart.getDate() - 14);
        if (cadStart < minDate) minDate = new Date(cadStart);
    });

    // Align minDate to Monday
    let day = minDate.getDay() || 7;
    if (day !== 1) minDate.setHours(-24 * (day - 1));

    let totalMs = maxDate - minDate;
    if (totalMs <= 0) totalMs = 1;

    // Generate columns
    let cols = [];
    let curr = new Date(minDate);
    while (curr < maxDate) {
        let next = new Date(curr);
        if (viewScale === 'weeks') {
            next.setDate(next.getDate() + 7);
            cols.push({
                label: `KW ${getWeekNum(curr)}`,
                sub: curr.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'}),
                start: new Date(curr),
                end: new Date(next)
            });
        } else {
            next.setMonth(next.getMonth() + 1);
            cols.push({
                label: curr.toLocaleDateString('de-DE', {month: 'short', year: '2-digit'}),
                sub: '',
                start: new Date(curr),
                end: new Date(next)
            });
        }
        curr = next;
        if (cols.length > 50) break; // limit safety
    }

    let todayPct = Math.max(0, Math.min(100, ((today - minDate) / totalMs) * 100));
    let targetPct = Math.max(0, Math.min(100, ((target - minDate) / totalMs) * 100));

    let html = `<table class="gantt-table">
        <thead>
            <tr>
                <th class="gantt-left-col">Bauteil & Baugruppe</th>`;
                
    cols.forEach(c => {
        html += `<th class="gantt-time-header">
            <div>${c.label}</div>
            <div style="font-size: 0.65rem; color: #64748b; font-weight: normal;">${c.sub}</div>
        </th>`;
    });

    html += `</tr>
        </thead>
        <tbody>`;

    // Group by Baugruppe -> Unterbaugruppe
    const groups = [...new Set(filtered.map(b => b["Baugruppe"] || 'Sonstiges'))].sort();
    
    groups.forEach(g => {
        let gParts = filtered.filter(b => (b["Baugruppe"] || 'Sonstiges') === g);
        html += `<tr style="background: rgba(15, 23, 42, 0.9);">
            <td class="gantt-left-col" style="font-weight: 800; color: #6366f1; font-size: 0.9rem; padding: 12px 14px; border-bottom: 2px solid #334155;">
                <i class="fa-solid fa-folder-open" style="margin-right: 6px;"></i> ${g} (${gParts.length})
            </td>
            <td colspan="${cols.length}" style="background: rgba(15, 23, 42, 0.4); border-bottom: 2px solid #334155;"></td>
        </tr>`;

        gParts.forEach((p, pIdx) => {
            let name = p["Bauteil-Name"] || 'Unbenannt';
            let ub = p["Unterbaugruppe"] || 'Keine';
            let status = p["Status"] || 'Nicht begonnen';
            let dates = p.dates || calculateDates(p);
            
            let dK = dates.kontrolle;
            let dA = dates.abschickdatum;
            let dL = dates.lieferdatum;
            
            let cadStart = new Date(dK);
            cadStart.setDate(cadStart.getDate() - 14); // estimate 2 weeks CAD before kontrolle
            
            let startPct = Math.max(0, Math.min(100, ((cadStart - minDate) / totalMs) * 100));
            let endPct = Math.max(0, Math.min(100, ((target - minDate) / totalMs) * 100));
            let barWidthPct = Math.max(2, endPct - startPct);
            
            let spanMs = target - cadStart;
            if (spanMs <= 0) spanMs = 1;
            
            let pCAD = Math.max(0, Math.min(100, ((dK - cadStart) / spanMs) * 100));
            let pKont = Math.max(0, Math.min(100, ((dA - dK) / spanMs) * 100));
            let pFert = Math.max(0, Math.min(100, ((dL - dA) / spanMs) * 100));
            let pAss = Math.max(0, Math.min(100, ((target - dL) / spanMs) * 100));

            let statusBadge = '';
            if (status === 'Assembled' || status === 'Fertig montiert') {
                statusBadge = `<span style="background: #059669; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; margin-left: 6px;"><i class="fa-solid fa-check"></i> Fertig</span>`;
            } else if (status === 'In Arbeit' || status === 'Fertigung / Warten') {
                statusBadge = `<span style="background: #2563eb; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; margin-left: 6px;">In Arbeit</span>`;
            } else {
                statusBadge = `<span style="background: #475569; color: #cbd5e1; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; margin-left: 6px;">Ausstehend</span>`;
            }

            let tooltipText = `${name} (${g} / ${ub})&#10;----------------------------&#10;🟣 Design/CAD: bis ${dK.toLocaleDateString('de-DE')}&#10;🟡 Kontrolle/Puffer: ${p["Kontrollzeit & Puffer"]||0} Tage (bis ${dA.toLocaleDateString('de-DE')})&#10;🔵 Fertigung: ${p["Fertigungsdauer"]||0} Tage (bis ${dL.toLocaleDateString('de-DE')})&#10;🟢 Assembly/Montage: ${parseInt(p["Assembly Zeit"]||0)+parseInt(p["Montage Zeit"]||0)} Tage (bis ${target.toLocaleDateString('de-DE')})`;

            html += `<tr>
                <td class="gantt-left-col" style="padding: 8px 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; color: var(--text-color); font-size: 0.85rem;" title="${name}">${name}</span>
                        ${statusBadge}
                    </div>
                    <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;"><i class="fa-solid fa-turn-up" style="transform: rotate(90deg); margin-right: 4px;"></i> ${ub}</div>
                </td>
                <td colspan="${cols.length}" class="gantt-time-cell">
                    <div class="gantt-timeline-container">
                        ${todayPct >= 0 && todayPct <= 100 ? `<div class="gantt-today-line" style="left: ${todayPct}%;" title="Heute (${today.toLocaleDateString('de-DE')})"></div>` : ''}
                        ${targetPct >= 0 && targetPct <= 100 ? `<div class="gantt-target-line" style="left: ${targetPct}%;" title="Rolling Chassis Target (${target.toLocaleDateString('de-DE')})"></div>` : ''}
                        
                        <div class="gantt-bar-wrapper" style="left: ${startPct}%; width: ${barWidthPct}%;" title="${tooltipText}">
                            <div class="gantt-seg gantt-seg-cad" style="width: ${pCAD}%;">CAD</div>
                            <div class="gantt-seg gantt-seg-kontrolle" style="width: ${pKont}%;">K</div>
                            <div class="gantt-seg gantt-seg-fertigung" style="width: ${pFert}%;">Fertigung</div>
                            <div class="gantt-seg gantt-seg-assembly" style="width: ${pAss}%;">Ass</div>
                        </div>
                    </div>
                </td>
            </tr>`;
        });
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
};

function logout() {
    sessionStorage.removeItem('suspension_auth');
    sessionStorage.removeItem('suspension_pw');
    sessionStorage.removeItem('suspension_readonly');
    location.href = location.pathname + "?v=" + new Date().getTime();
}
