const App = {
    // State
    data: {},
    deudas: [],
    saldoInicial: 0,
    saldoInicialForma: 'Cuenta',
    currentYear: 2026,
    currentMonthVal: '01', // '01' to '12'
    months: [],

    // Config
    IVA_RATE: 0.21,
    IRPF_RATE: 0.19,

    init() {
        this.updateMonthList();

        // Setup initial default empty state for current year
        this.initializeDataStructure();

        // Check date for default initialization
        const today = new Date();
        this.currentYear = today.getFullYear();
        document.getElementById('yearSelector').value = this.currentYear;
        const m = String(today.getMonth() + 1).padStart(2, '0');
        this.currentMonthVal = m;
        document.getElementById('inputFecha').value = `${this.currentYear}-${m}-${String(today.getDate()).padStart(2, '0')}`;

        this.updateMonthList();

        // Setup UI
        this.updateInputCategory();
        this.loadMonth(`${this.currentYear}-${this.currentMonthVal}`);
        this.updateAllSummaries();

        // Check status
        this.checkStatus();
    },

    async checkStatus() {
        try {
            const res = await fetch('/api/native/status');
            const json = await res.json();
            if (json.currentFile) {
                document.getElementById('openFileName').textContent = `📂 ${json.currentFile}`;
            }
        } catch (e) { }
    },

    initializeDataStructure() {
        this.months = [];
        for (let i = 1; i <= 12; i++) {
            const m = String(i).padStart(2, '0');
            const key = `${this.currentYear}-${m}`;
            this.months.push(key);
            if (!this.data[key]) this.data[key] = [];
        }
    },

    changeYear(year) {
        this.currentYear = parseInt(year);
        this.initializeDataStructure();
        this.updateMonthList();
        // Reset current month selection to avoid invalid month keys
        this.loadMonth(`${this.currentYear}-${this.currentMonthVal}`);
        this.updateAllSummaries();
    },

    updateMonthList() {
        const select = document.getElementById('currentMonth');
        select.innerHTML = '';
        const monthNames = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];

        monthNames.forEach((name, index) => {
            const mVal = String(index + 1).padStart(2, '0');
            const key = `${this.currentYear}-${mVal}`;
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = `${name} ${this.currentYear}`;
            if (mVal === this.currentMonthVal) opt.selected = true;
            select.appendChild(opt);
        });
    },

    // --- API Interactions ---

    // --- Native File Operations ---

    getPayload() {
        return {
            year: this.currentYear,
            saldoInicial: this.saldoInicial,
            saldoInicialForma: this.saldoInicialForma,
            movements: this.data,
            deudas: this.deudas
        };
    },

    async nativeSave() {
        try {
            const res = await fetch('/api/native/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: this.getPayload() })
            });
            const json = await res.json();
            if (json.success) {
                document.getElementById('openFileName').textContent = `📂 ${json.filename}`;
                alert("Guardado exitosamente.");
            } else if (!json.cancelled) {
                alert("Error al guardar: " + json.error);
            }
        } catch (e) { alert("Error de conexión"); }
    },

    async nativeSaveAs() {
        try {
            const res = await fetch('/api/native/save_as', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: this.getPayload(),
                    currentFilename: `contabilidad_${this.currentYear}`
                })
            });
            const json = await res.json();
            if (json.success) {
                document.getElementById('openFileName').textContent = `📂 ${json.filename}`;
                alert("Guardado como nuevo archivo.");
            }
        } catch (e) { alert("Error de conexión"); }
    },

    async nativeOpen() {
        try {
            const res = await fetch('/api/native/open');
            const json = await res.json();
            if (json.success) {
                this.loadFromData(json.data, json.filename);
                document.getElementById('openFileName').textContent = `📂 ${json.filename}`;
            }
        } catch (e) { alert("Error al abrir archivo"); }
    },

    loadFromData(json, filename) {
        // Restore state
        this.currentYear = json.year || 2026;
        document.getElementById('yearSelector').value = this.currentYear;
        // document.getElementById('currentFilename').value = filename.replace('.json', ''); // Removed input

        this.saldoInicial = json.saldoInicial || 0;
        this.saldoInicialForma = json.saldoInicialForma || 'Cuenta';
        document.getElementById('saldoInicial').value = this.saldoInicial;
        document.getElementById('saldoForma').value = this.saldoInicialForma;

        this.data = json.movements || {};
        this.deudas = json.deudas || [];

        this.initializeDataStructure();
        this.updateMonthList();
        this.loadMonth(`${this.currentYear}-01`);
        this.updateAllSummaries();
        this.renderDeudas();
    },

    newFile() {
        if (confirm("¿Estás seguro? Se borrarán los datos de la vista actual (si no has guardado se perderán).")) {
            this.data = {};
            this.deudas = [];
            this.saldoInicial = 0;
            this.initializeDataStructure();
            this.updateAllSummaries();
            this.renderDeudas();
            document.getElementById('openFileName').textContent = '(Nuevo Archivo)';
            this.loadMonth(`${this.currentYear}-01`);
            // Tell backend to reset path? Optional.
        }
    },

    // --- Logic & UI ---

    updateInputCategory() {
        const tipo = document.getElementById('inputTipo').value;
        const catSelect = document.getElementById('inputCategoria');
        const ivaInput = document.getElementById('inputIVA');
        const retSelect = document.getElementById('inputRetencion');

        // Reset
        ivaInput.disabled = true;
        retSelect.disabled = true;
        document.getElementById('inputRetencionMonto').disabled = true;

        if (tipo === 'Ingreso') {
            catSelect.innerHTML = `
                <option value="Ingreso D">Ingreso D (Negocio)</option>
                <option value="Ingreso No D">Ingreso No D (Personal)</option>
            `;
            // Enable Retention mainly for Business Income
            catSelect.onchange = () => {
                if (catSelect.value === 'Ingreso D') retSelect.disabled = false;
                else {
                    retSelect.disabled = true;
                    retSelect.value = 'no';
                    this.toggleRetencionAmount();
                }
            };
            catSelect.dispatchEvent(new Event('change')); // trigger check

        } else {
            catSelect.innerHTML = `
                <option value="Gasto Despacho">Gasto Despacho</option>
                <option value="Gasto Personal">Gasto Personal</option>
            `;
            catSelect.onchange = () => {
                if (catSelect.value === 'Gasto Despacho') ivaInput.disabled = false;
                else {
                    ivaInput.disabled = true;
                    ivaInput.value = '';
                }
            };
            catSelect.dispatchEvent(new Event('change'));
        }
    },

    toggleRetencionAmount() {
        const ret = document.getElementById('inputRetencion').value;
        const input = document.getElementById('inputRetencionMonto');
        input.disabled = ret !== 'si';
        if (ret !== 'si') input.value = '';
    },

    setSaldoInicial() {
        this.saldoInicial = parseFloat(document.getElementById('saldoInicial').value) || 0;
        this.saldoInicialForma = document.getElementById('saldoForma').value;
        alert(`Saldo inicial: ${this.saldoInicial} € (${this.saldoInicialForma})`);
        this.updateAllSummaries();
    },

    loadMonth(monthKey) {
        if (!monthKey) return;
        const [y, m] = monthKey.split('-');
        this.currentMonthVal = m;
        document.getElementById('currentMonth').value = monthKey;

        // Title
        const monthNames = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        const mName = monthNames[parseInt(m) - 1];
        document.getElementById('mesTitulo').textContent = `${mName} ${y}`;
        document.getElementById('dashboardMonthTitle').textContent = `${mName}`;

        // Show saldo initial only in January (or first month if we want logic)
        document.getElementById('saldoInicialSection').style.display = (m === '01') ? 'block' : 'none';

        // Render Table
        const tbody = document.getElementById('mesBody');
        tbody.innerHTML = '';
        const movs = this.data[monthKey] || [];

        movs.forEach((mov, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${mov.fecha}</td>
                <td>${mov.concepto}</td>
                <td>${mov.cliente}</td>
                <td>${mov.tipo}</td>
                <td>${mov.categoria}</td>
                <td>${mov.importe.toFixed(2)} €</td>
                <td>${mov.pago}</td>
                <td>${mov.ivaSup ? mov.ivaSup.toFixed(2) : '-'}</td>
                <td>${mov.retencion ? mov.retencionMonto.toFixed(2) : '-'}</td>
                <td><button class="btn-delete" onclick="App.deleteMovement('${monthKey}', ${idx})">🗑️</button></td>
            `;
            tbody.appendChild(tr);
        });

        this.updateMonthlyDashboard(monthKey);
    },

    addMovement() {
        const fecha = document.getElementById('inputFecha').value;
        if (!fecha) return alert("Falta la fecha.");

        const [y, m, d] = fecha.split('-');
        if (parseInt(y) !== this.currentYear) {
            if (!confirm(`La fecha es del año ${y}, pero estás editando el ${this.currentYear}. ¿Quieres continuar?`)) return;
        }

        const mesKey = `${y}-${m}`;
        if (!this.data[mesKey]) this.data[mesKey] = [];

        const mov = {
            fecha,
            concepto: document.getElementById('inputConcepto').value,
            cliente: document.getElementById('inputCliente').value,
            tipo: document.getElementById('inputTipo').value,
            categoria: document.getElementById('inputCategoria').value,
            importe: parseFloat(document.getElementById('inputImporte').value) || 0,
            pago: document.getElementById('inputPago').value,
            ivaSup: parseFloat(document.getElementById('inputIVA').value) || 0,
            retencion: document.getElementById('inputRetencion').value === 'si',
            retencionMonto: parseFloat(document.getElementById('inputRetencionMonto').value) || 0
        };

        if (mov.importe <= 0) return alert("El importe debe ser mayor a 0");

        this.data[mesKey].push(mov);

        // Clear inputs
        document.getElementById('inputConcepto').value = '';
        document.getElementById('inputCliente').value = '';
        document.getElementById('inputImporte').value = '';
        document.getElementById('inputIVA').value = '';
        document.getElementById('inputRetencionMonto').value = '';

        // Refresh
        if (y == this.currentYear && m == this.currentMonthVal) {
            this.loadMonth(mesKey);
        }
        this.updateAllSummaries();
    },

    deleteMovement(monthKey, index) {
        if (!confirm("¿Borrar este movimiento?")) return;
        this.data[monthKey].splice(index, 1);
        this.loadMonth(monthKey);
        this.updateAllSummaries();
    },

    // --- Calculations ---

    calculateMonth(monthKey) {
        const movs = this.data[monthKey] || [];
        const res = {
            ingresosD: 0, ingresosNoD: 0, gastosDesp: 0, gastosPers: 0,
            ivaGenerado: 0, ivaSoportado: 0, irpfDevengado: 0, irpfRetenido: 0,
            efectivo: 0, cuentas: 0
        };

        movs.forEach(m => {
            if (m.categoria === 'Ingreso D') {
                res.ingresosD += m.importe;
                res.ivaGenerado += m.importe * this.IVA_RATE;
                res.irpfDevengado += m.importe * this.IRPF_RATE; // Simplified assumption
                if (m.retencion) res.irpfRetenido += m.retencionMonto;
            } else if (m.categoria === 'Ingreso No D') {
                res.ingresosNoD += m.importe;
            } else if (m.categoria === 'Gasto Despacho') {
                res.gastosDesp += m.importe;
                res.ivaSoportado += m.ivaSup || 0;
            } else if (m.categoria === 'Gasto Personal') {
                res.gastosPers += m.importe;
            }

            // Cash flow
            const val = m.tipo === 'Ingreso' ? m.importe : -m.importe;
            if (m.pago === 'Efectivo') res.efectivo += val;
            else res.cuentas += val;
        });

        // Computed
        res.totalIngresos = res.ingresosD + res.ingresosNoD;
        res.totalGastos = res.gastosDesp + res.gastosPers;
        res.resPersonal = res.totalIngresos - res.totalGastos;
        res.ivaNeto = res.ivaGenerado - res.ivaSoportado;
        res.irpfNeto = res.irpfDevengado - res.irpfRetenido;

        return res;
    },

    updateMonthlyDashboard(monthKey) {
        // We need cumulative data up to this month
        let cumulative = {
            resPersonal: 0, ivaNeto: 0, irpfNeto: 0
        };

        const targetM = parseInt(monthKey.split('-')[1]);

        for (let i = 1; i <= targetM; i++) {
            const k = `${this.currentYear}-${String(i).padStart(2, '0')}`;
            const c = this.calculateMonth(k);
            cumulative.resPersonal += c.resPersonal;
            cumulative.ivaNeto += c.ivaNeto;
            cumulative.irpfNeto += c.irpfNeto;
        }

        const totalImpuestos = cumulative.ivaNeto + cumulative.irpfNeto;
        const disponible = cumulative.resPersonal - totalImpuestos;
        // Adjust for debt?? (Maybe debt is separate)

        // UI
        const setVal = (id, val, neutralClass = '') => {
            const el = document.getElementById(id);
            el.textContent = val.toFixed(2) + ' €';
            el.className = 'dashboard-value ' + (val >= 0 ? 'positive' : 'negative') + ' ' + neutralClass;
        };

        setVal('resPersonal', cumulative.resPersonal);
        setVal('impuestos', totalImpuestos, 'orange'); // Just orange
        setVal('dispTotal', disponible);

        document.getElementById('ivaNeto').textContent = cumulative.ivaNeto.toFixed(2) + ' €';
        document.getElementById('irpfNeto').textContent = cumulative.irpfNeto.toFixed(2) + ' €';

        const d = this.getTotalDeuda();
        const dEl = document.getElementById('deudaActual');
        dEl.textContent = d.toFixed(2) + ' €';
        dEl.className = 'dashboard-value ' + (d <= 0 ? 'positive' : 'negative');
    },

    updateAllSummaries() {
        // 1. Monthly Table
        const tbody = document.querySelector('#resumenMensual tbody');
        tbody.innerHTML = '';
        const annual = {
            ingD: 0, ingNoD: 0, gasD: 0, gasP: 0,
            ivaNet: 0, irpfNet: 0,
            efec: 0, cuen: 0
        };

        this.months.forEach(mKey => {
            const c = this.calculateMonth(mKey);
            annual.ingD += c.ingresosD;
            annual.ingNoD += c.ingresosNoD;
            annual.gasD += c.gastosDesp;
            annual.gasP += c.gastosPers;
            annual.ivaNet += c.ivaNeto;
            annual.irpfNet += c.irpfNeto;
            annual.efec += c.efectivo;
            annual.cuen += c.cuentas;

            // Only show month in summary rows if it has data or is current? 
            // Better to show all for structure
            const row = document.createElement('tr');
            const mName = new Date(mKey + '-01').toLocaleDateString('es-ES', { month: 'short' });
            row.innerHTML = `
                <td><b>${mName}</b></td>
                <td class="light-green">${c.ingresosD.toFixed(2)}</td>
                <td class="light-green">${c.ingresosNoD.toFixed(2)}</td>
                <td class="light-red">${c.gastosDesp.toFixed(2)}</td>
                <td class="light-red">${c.gastosPers.toFixed(2)}</td>
                <td>${c.totalIngresos.toFixed(2)}</td>
                <td>${c.totalGastos.toFixed(2)}</td>
                <td class="${c.resPersonal >= 0 ? 'positive' : 'negative'}">${c.resPersonal.toFixed(2)}</td>
                <td class="light-orange">${c.ivaNeto.toFixed(2)}</td>
                <td class="light-orange">${c.irpfNeto.toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        });

        // 2. Quarterly
        const qBody = document.querySelector('#resumenTrimestral tbody');
        qBody.innerHTML = '';
        for (let q = 1; q <= 4; q++) {
            let qSum = { ingD: 0, gasD: 0, ivaN: 0, irpfN: 0 };
            for (let m = 0; m < 3; m++) {
                const monthIdx = (q - 1) * 3 + m + 1;
                const key = `${this.currentYear}-${String(monthIdx).padStart(2, '0')}`;
                const c = this.calculateMonth(key);
                qSum.ingD += c.ingresosD;
                qSum.gasD += c.gastosDesp;
                qSum.ivaN += c.ivaNeto;
                qSum.irpfN += c.irpfNeto;
            }
            const resNeg = qSum.ingD - qSum.gasD;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><b>Q${q}</b></td>
                <td>${qSum.ingD.toFixed(2)} €</td>
                <td>${qSum.gasD.toFixed(2)} €</td>
                <td class="${resNeg >= 0 ? 'positive' : 'negative'}">${resNeg.toFixed(2)} €</td>
                <td class="light-orange">${qSum.ivaN.toFixed(2)} €</td>
                <td class="light-orange">${qSum.irpfN.toFixed(2)} €</td>
            `;
            qBody.appendChild(row);
        }

        // 3. Annual
        document.getElementById('annualYearLabel').textContent = this.currentYear;

        document.getElementById('anualIngresosD').textContent = annual.ingD.toFixed(2) + ' €';
        document.getElementById('anualGastosD').textContent = annual.gasD.toFixed(2) + ' €';
        document.getElementById('anualResNegocio').textContent = (annual.ingD - annual.gasD).toFixed(2) + ' €';
        document.getElementById('anualIVANeto').textContent = annual.ivaNet.toFixed(2) + ' €';
        document.getElementById('anualIRPFNeto').textContent = annual.irpfNet.toFixed(2) + ' €';

        const totIng = annual.ingD + annual.ingNoD;
        const totGas = annual.gasD + annual.gasP;
        document.getElementById('anualIngresosTot').textContent = totIng.toFixed(2) + ' €';
        document.getElementById('anualGastosTot').textContent = totGas.toFixed(2) + ' €';
        document.getElementById('anualResPersonal').textContent = (totIng - totGas).toFixed(2) + ' €';

        // Add Saldo Inicial logic
        let saldoC = annual.cuen;
        let saldoE = annual.efec;
        if (this.saldoInicialForma === 'Efectivo') saldoE += this.saldoInicial;
        else saldoC += this.saldoInicial;

        document.getElementById('anualCuentas').textContent = saldoC.toFixed(2) + ' €';
        document.getElementById('anualEfectivo').textContent = saldoE.toFixed(2) + ' €';
    },

    // --- Deudas ---

    addDebt() {
        const concepto = document.getElementById('deudaConcepto').value;
        const importe = parseFloat(document.getElementById('deudaImporte').value) || 0;
        const tipo = document.getElementById('deudaTipo').value;
        const fecha = new Date().toISOString().split('T')[0]; // simple today

        if (!concepto || importe <= 0) return alert('Datos inválidos');

        const monto = tipo === 'nueva' ? importe : -importe;
        this.deudas.push({ fecha, concepto, tipo, importe, monto });

        document.getElementById('deudaConcepto').value = '';
        document.getElementById('deudaImporte').value = '';
        this.renderDeudas();
        this.updateMonthlyDashboard(`${this.currentYear}-${this.currentMonthVal}`); // update debt card
    },

    renderDeudas() {
        const tbody = document.getElementById('deudasBody');
        tbody.innerHTML = '';
        let saldo = 0;
        this.deudas.forEach(d => {
            saldo += d.monto;
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${d.fecha}</td>
                <td>${d.concepto}</td>
                <td>${d.tipo === 'nueva' ? '🔴 Deuda' : '🟢 Pago'}</td>
                <td>${Math.abs(d.monto).toFixed(2) + ' €'}</td>
                <td style="font-weight:bold">${saldo.toFixed(2)} €</td>
            `;
        });
    },

    getTotalDeuda() {
        return this.deudas.reduce((sum, d) => sum + d.monto, 0);
    },

    nextMonth() {
        let m = parseInt(this.currentMonthVal);
        if (m < 12) {
            m++;
            const nextK = `${this.currentYear}-${String(m).padStart(2, '0')}`;
            this.loadMonth(nextK);
        } else {
            alert("Estás en Diciembre. Cambia de año para continuar.");
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
