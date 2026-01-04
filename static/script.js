const App = {
    currentMonth: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    currentYear: new Date().getFullYear(),
    initialized: false,
    deleted_recurring_tracker: [], // Para evitar re-añadir pagos borrados en la sesión
    data: {
        movimientos: [],
        saldos_iniciales: [],
        deudas: []
    },

    init: function () {
        const today = new Date();
        document.getElementById('inputFecha').valueAsDate = today;
        document.getElementById('debtFechaInicio').valueAsDate = today;
        this.populateMonths();
        this.updateInputCategory();
        this.loadCurrentFile();
        this.initialized = true;

        // Configurar eventos para actualizaciones en tiempo real
        this.setupEventListeners();

        // Actualizar año actual en pantalla
        document.getElementById('currentYearDisplay').textContent = this.currentYear;
        document.getElementById('currentYearDisplay2').textContent = this.currentYear;
    },

    // --- File operations ---
    nativeOpen: function () {
        fetch('/api/native/open')
            .then(r => r.json())
            .then(res => {
                if (res.success) {
                    this.data = res.data;
                    document.getElementById('openFileName').textContent = res.filename;
                    this.loadYear(this.currentYear);
                    this.updateDashboard();
                    this.updateQuarterlySummary();
                    this.renderMonth(this.currentMonth);
                    this.renderInitialBalances();
                    this.renderDebts();
                    alert('Archivo cargado correctamente');
                } else if (!res.cancelled) {
                    alert('Error: ' + res.error);
                }
            })
            .catch(err => {
                alert('Error de conexión: ' + err.message);
            });
    },

    nativeSave: function () {
        const data = {
            data: this.data,
            currentFilename: document.getElementById('openFileName').textContent
        };

        fetch('/api/native/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
            .then(r => r.json())
            .then(res => {
                if (res.success) {
                    console.log('Guardado exitoso');
                } else {
                    alert('Error al guardar: ' + res.error);
                }
            })
            .catch(err => {
                alert('Error de conexión: ' + err.message);
            });
    },

    nativeSaveAs: function () {
        const current = document.getElementById('openFileName').textContent;
        const currentFilename = current === '(Sin archivo abierto)' ? 'contabilidad.json' : current;

        fetch('/api/native/save_as', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: this.data,
                currentFilename: currentFilename
            })
        })
            .then(r => r.json())
            .then(res => {
                if (res.success) {
                    document.getElementById('openFileName').textContent = res.filename;
                    alert('Archivo guardado como: ' + res.filename);
                } else if (!res.cancelled) {
                    alert('Error: ' + res.error);
                }
            })
            .catch(err => {
                alert('Error de conexión: ' + err.message);
            });
    },

    newFile: function () {
        if (confirm('¿Crear nuevo archivo? Se perderán los cambios no guardados.')) {
            this.data = {
                movimientos: [],
                saldos_iniciales: [],
                deudas: []
            };
            document.getElementById('openFileName').textContent = '(Sin archivo abierto)';
            this.loadYear(this.currentYear);
            this.updateDashboard();
            this.updateQuarterlySummary();
            this.renderMonth(this.currentMonth);
            this.renderInitialBalances();
            this.renderDebts();
        }
    },

    loadCurrentFile: function () {
        fetch('/api/native/load_current')
            .then(r => r.json())
            .then(res => {
                if (res.success) {
                    this.data = res.data;
                    document.getElementById('openFileName').textContent = res.filename;
                    this.loadYear(this.currentYear);
                    this.updateDashboard();
                    this.updateQuarterlySummary();
                    this.renderMonth(this.currentMonth);
                    this.renderInitialBalances();
                    this.renderDebts();
                } else {
                    console.error('Error al cargar:', res.error);
                    // Crear datos vacíos
                    this.data = {
                        movimientos: [],
                        saldos_iniciales: [],
                        deudas: []
                    };
                    this.renderDebts();
                }
            })
            .catch(err => {
                console.error('Error de conexión:', err);
                // Crear datos vacíos en caso de error
                this.data = {
                    movimientos: [],
                    saldos_iniciales: [],
                    deudas: []
                };
                this.renderDebts();
            });
    },

    shutdown: function () {
        if (confirm('¿Cerrar la aplicación?')) {
            fetch('/shutdown', {
                method: 'POST'
            })
                .then(() => {
                    setTimeout(() => {
                        window.close();
                    }, 500);
                });
        }
    },

    // --- UI helpers ---
    populateMonths: function () {
        const select = document.getElementById('currentMonth');
        select.innerHTML = '';
        const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        months.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = names[i];
            if (m === this.currentMonth) opt.selected = true;
            select.appendChild(opt);
        });
    },

    loadYear: function (year) {
        this.currentYear = parseInt(year);
        document.getElementById('yearSelector').value = this.currentYear;
        document.getElementById('annualYearLabel').textContent = this.currentYear;
        document.getElementById('currentYearDisplay').textContent = this.currentYear;
        document.getElementById('currentYearDisplay2').textContent = this.currentYear;
        this.renderMonth(this.currentMonth);
        this.updateDashboard();
        this.updateQuarterlySummary();
        this.renderInitialBalances();
    },

    changeYear: function (year) {
        this.loadYear(year);
    },

    loadMonth: function (month) {
        this.currentMonth = month;
        this.processRecurringDebtPayments(this.currentYear, month);
        this.renderMonth(month);
    },

    nextMonth: function () {
        let m = parseInt(this.currentMonth);
        if (m < 12) {
            this.loadMonth(String(m + 1).padStart(2, '0'));
        }
    },

    // --- Setup event listeners ---
    setupEventListeners: function () {
        // Para el formulario de movimientos
        document.getElementById('inputTipo').addEventListener('change', () => {
            this.updateInputCategory();
            this.updateFormVisibility();
        });

        document.getElementById('inputCategoria').addEventListener('change', () => {
            this.updateFormVisibility();
            this.updateDashboard();
        });

        document.getElementById('inputConIVA').addEventListener('change', () => {
            this.updateFormVisibility();
            this.updateDashboard();
        });

        document.getElementById('inputRetencion').addEventListener('change', () => {
            this.updateFormVisibility();
            this.updateDashboard();
        });

        // Para saldos iniciales
        document.getElementById('yearSelector').addEventListener('change', (e) => {
            this.changeYear(e.target.value);
        });

        // Actualizar en tiempo real cuando cambien los valores
        const realTimeInputs = ['inputConcepto', 'inputCliente', 'inputImporte', 'inputIVA', 'inputRetencionMonto', 'inputBaseImponibleGasto'];
        realTimeInputs.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                elem.addEventListener('input', () => {
                    if (this.initialized) {
                        this.updateDashboard();
                    }
                });
            }
        });
    },

    // --- Form visibility control ---
    updateFormVisibility: function () {
        const tipo = document.getElementById('inputTipo').value;
        const categoria = document.getElementById('inputCategoria').value;
        const conIVA = document.getElementById('inputConIVA').value === 'si';

        // Mostrar/ocultar campos de ingresos
        const ivaIngresoField = document.getElementById('ivaIngresoField');
        const retencionField = document.getElementById('retencionField');
        const retencionMontoField = document.getElementById('retencionMontoField');

        if (tipo === 'Ingreso') {
            ivaIngresoField.style.display = 'block';
            retencionField.style.display = 'block';

            if (conIVA) {
                retencionField.style.display = 'block';
                const tieneRetencion = document.getElementById('inputRetencion').value === 'si';
                retencionMontoField.style.display = tieneRetencion ? 'block' : 'none';
                document.getElementById('inputRetencionMonto').disabled = !tieneRetencion;
            } else {
                retencionField.style.display = 'none';
                retencionMontoField.style.display = 'none';
                document.getElementById('inputRetencionMonto').disabled = true;
            }
        } else {
            ivaIngresoField.style.display = 'none';
            retencionField.style.display = 'none';
            retencionMontoField.style.display = 'none';
            document.getElementById('inputRetencionMonto').disabled = true;
        }

        // Mostrar/ocultar campos de gastos
        const ivaGastoField = document.getElementById('ivaGastoField');
        const baseImponibleGastoField = document.getElementById('baseImponibleGastoField');

        if (tipo === 'Gasto') {
            if (categoria === 'Gastos Despacho') {
                ivaGastoField.style.display = 'block';
                baseImponibleGastoField.style.display = 'block';
                document.getElementById('inputIVA').disabled = false;
                document.getElementById('inputBaseImponibleGasto').disabled = false;
            } else {
                ivaGastoField.style.display = 'none';
                baseImponibleGastoField.style.display = 'none';
                document.getElementById('inputIVA').disabled = true;
                document.getElementById('inputBaseImponibleGasto').disabled = true;
            }
        } else {
            ivaGastoField.style.display = 'none';
            baseImponibleGastoField.style.display = 'none';
        }
    },

    // --- Recurrent movement expansion ---
    expandRecurrentMovements: function (movimientos, year) {
        const expanded = [];
        const seen = new Set();

        movimientos.forEach(m => {
            const key = `${m.fecha}|${m.concepto}|${m.importe}|${m.tipo}`;
            if (!seen.has(key)) {
                expanded.push({ ...m });
                seen.add(key);
            }

            if (m.recurrente) {
                const baseDate = new Date(m.fecha);
                for (let i = 1; i <= 12; i++) {
                    const newDate = new Date(year, i - 1, baseDate.getDate());
                    const newKey = `${newDate.toISOString().split('T')[0]}|${m.concepto} (Recurrente)|${m.importe}|${m.tipo}`;

                    if (!seen.has(newKey) && newDate.getFullYear() === year) {
                        seen.add(newKey);
                        expanded.push({
                            ...m,
                            fecha: newDate.toISOString().split('T')[0],
                            concepto: `${m.concepto} (Recurrente)`,
                            recurrente: false
                        });
                    }
                }
            }
        });

        return expanded;
    },

    // --- Movement form ---
    updateInputCategory: function () {
        const tipo = document.getElementById('inputTipo').value;
        const cat = document.getElementById('inputCategoria');

        cat.innerHTML = '';

        if (tipo === 'Ingreso') {
            // Ingresos: distinguir entre negocio y personal
            const ingresosOptions = [
                { value: 'Honorarios Despacho', text: 'Honorarios Despacho (con IVA)' },
                { value: 'Ingresos Personales', text: 'Ingresos Personales (sin IVA)' },
                { value: 'Otros Ingresos Negocio', text: 'Otros Ingresos Negocio (con IVA)' }
            ];

            ingresosOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                cat.appendChild(option);
            });
        } else {
            // Gastos: del despacho o personales
            const gastosOptions = [
                { value: 'Gastos Despacho', text: 'Gastos Despacho (con IVA)' },
                { value: 'Gastos Personales', text: 'Gastos Personales (sin IVA)' },
                { value: 'Suministros', text: 'Suministros' },
                { value: 'Alquiler', text: 'Alquiler' },
                { value: 'Material', text: 'Material' },
                { value: 'Gastos Generales', text: 'Gastos Generales' }
            ];

            gastosOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                cat.appendChild(option);
            });
        }

        // Actualizar visibilidad después de cambiar categorías
        this.updateFormVisibility();
    },

    // ✅ CORRECCIÓN COMPLETA: manejo correcto de IVA e IRPF según especificaciones
    addMovement: function () {
        const fecha = document.getElementById('inputFecha').value;
        const concepto = document.getElementById('inputConcepto').value.trim();
        const cliente = document.getElementById('inputCliente').value.trim();
        const tipo = document.getElementById('inputTipo').value;
        const categoria = document.getElementById('inputCategoria').value;
        const importeInput = document.getElementById('inputImporte').value;
        const pago = document.getElementById('inputPago').value;

        // Validaciones
        if (!concepto) {
            alert('El concepto es obligatorio');
            return;
        }

        if (!importeInput || isNaN(parseFloat(importeInput)) || parseFloat(importeInput) <= 0) {
            alert('El importe debe ser un número positivo válido');
            return;
        }

        const importe = parseFloat(importeInput);
        let iva_soportado = 0;
        let retencion = 0;
        let con_iva = false;
        let base_imponible = 0;
        let es_negocio = false;

        if (tipo === 'Ingreso') {
            // Determinar si es ingreso de negocio (con IVA)
            es_negocio = categoria === 'Honorarios Despacho' || categoria === 'Otros Ingresos Negocio';
            con_iva = es_negocio;

            if (con_iva) {
                // Para ingresos con IVA: el importe incluye IVA (21%)
                base_imponible = importe / 1.21;
                const ivaCalculado = base_imponible * 0.21;

                // Verificar si hay retención de IRPF (pagador retiene)
                if (document.getElementById('inputRetencion').value === 'si') {
                    const retencionInput = document.getElementById('inputRetencionMonto').value;
                    retencion = retencionInput ? parseFloat(retencionInput) : 0;
                } else {
                    // Si no hay retención, se calcula el 19% como IRPF a pagar
                    retencion = -1 * (base_imponible * 0.19); // Negativo porque es lo que DEBO
                }
            } else {
                // Ingreso personal: sin impuestos
                base_imponible = importe;
            }
        } else {
            // GASTO
            if (categoria === 'Gastos Despacho') {
                // Gasto de despacho: puede tener IVA soportado
                const ivaInput = document.getElementById('inputIVA').value;
                iva_soportado = ivaInput ? parseFloat(ivaInput) : 0;

                const baseInput = document.getElementById('inputBaseImponibleGasto').value;
                base_imponible = baseInput ? parseFloat(baseInput) : (importe - iva_soportado);

                // El resto del importe (si lo hay) es gasto personal no deducible
                const gasto_personal = importe - base_imponible - iva_soportado;
                if (gasto_personal > 0) {
                    alert(`Nota: ${gasto_personal.toFixed(2)}€ se considerarán gasto personal no deducible.`);
                }
            } else {
                // Gasto personal: sin IVA
                base_imponible = importe;
            }
        }

        const nuevo = {
            fecha,
            concepto,
            cliente: cliente || '',
            tipo,
            categoria,
            importe,
            pago,
            iva_soportado,
            retencion, // Positivo: me retienen, Negativo: debo pagar
            base_imponible: base_imponible || 0,
            con_iva,
            recurrente: document.getElementById('inputRecurrente').checked,
            fecha_registro: new Date().toISOString()
        };

        this.data.movimientos.push(nuevo);

        // Guardar inmediatamente
        this.nativeSave();

        // Actualizar interfaz
        this.renderMonth(this.currentMonth);
        this.clearInputs();

        // Mostrar confirmación
        alert('Movimiento registrado correctamente');
    },

    clearInputs: function () {
        document.getElementById('inputConcepto').value = '';
        document.getElementById('inputCliente').value = '';
        document.getElementById('inputImporte').value = '';
        document.getElementById('inputIVA').value = '';
        document.getElementById('inputRetencion').value = 'no';
        document.getElementById('inputRetencionMonto').value = '';
        document.getElementById('inputBaseImponibleGasto').value = '';
        document.getElementById('inputRecurrente').checked = false;
        document.getElementById('inputConIVA').value = 'no';
        document.getElementById('inputFecha').valueAsDate = new Date();
        this.updateInputCategory();
    },

    deleteMovement: function (fecha, concepto, importe, tipo) {
        if (!confirm('¿Eliminar este movimiento?')) return;

        // Encontrar el índice del movimiento
        const index = this.data.movimientos.findIndex(m =>
            m.fecha === fecha &&
            m.concepto === concepto &&
            parseFloat(m.importe) === parseFloat(importe) &&
            m.tipo === tipo
        );

        if (index !== -1) {
            const movement = this.data.movimientos[index];

            // Si es un pago de deuda, devolver el saldo a la deuda
            if (movement.categoria === 'Pago Deuda' && movement.debt_id) {
                const debt = this.data.deudas.find(d => d.id === movement.debt_id);
                if (debt) {
                    debt.importe_pagado = Math.max(0, debt.importe_pagado - movement.importe);
                    // Si era recurrente, anotarlo para no volver a crearlo automáticamente en esta sesión
                    if (movement.is_recurring_debt) {
                        const monthKey = movement.fecha.substring(0, 7); // YYYY-MM
                        this.deleted_recurring_tracker.push(`${movement.debt_id}|${monthKey}`);
                    }
                }
            }

            this.data.movimientos.splice(index, 1);
            this.nativeSave();
            this.renderMonth(this.currentMonth);
            this.renderDebts();
            alert('Movimiento eliminado');
        }
    },

    // ✅ CORRECCIÓN: Permitir múltiples saldos iniciales
    addInitialBalance: function () {
        const desc = document.getElementById('initDesc').value.trim();
        const imp = parseFloat(document.getElementById('initImporte').value);
        const forma = document.getElementById('initForma').value;

        if (!desc) {
            alert('La descripción es obligatoria');
            return;
        }

        if (isNaN(imp) || imp <= 0) {
            alert('El importe debe ser un número positivo');
            return;
        }

        // Añadir nuevo saldo inicial (permite múltiples)
        this.data.saldos_iniciales.push({
            year: this.currentYear,
            descripcion: desc,
            importe: imp,
            forma: forma,
            fecha_registro: new Date().toISOString()
        });

        // Guardar inmediatamente
        this.nativeSave();

        // Actualizar interfaz
        this.renderInitialBalances();

        // Limpiar formulario
        document.getElementById('initDesc').value = '';
        document.getElementById('initImporte').value = '';

        alert('Saldo inicial registrado correctamente');
    },

    // Renderizar saldos iniciales en su propia sección
    renderInitialBalances: function () {
        const tbody = document.getElementById('initialBalancesBody');
        tbody.innerHTML = '';

        // Filtrar saldos del año actual
        const saldosAnio = this.data.saldos_iniciales.filter(s => s.year === this.currentYear);

        if (saldosAnio.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#666;">No hay saldos iniciales registrados para este año</td></tr>';
            return;
        }

        let totalCuentas = 0;
        let totalEfectivo = 0;

        saldosAnio.forEach(s => {
            const row = tbody.insertRow();
            const importe = parseFloat(s.importe) || 0;

            if (s.forma === 'Cuenta') {
                totalCuentas += importe;
            } else {
                totalEfectivo += importe;
            }

            row.innerHTML = `
                <td>${s.descripcion}</td>
                <td>${importe.toFixed(2)} €</td>
                <td>${s.forma === 'Cuenta' ? 'Cuenta Bancaria' : 'Efectivo'}</td>
                <td>${s.year}</td>
                <td><button onclick="App.deleteInitialBalance('${s.descripcion}', ${importe}, '${s.forma}', ${s.year})" class="btn-delete">🗑️</button></td>
            `;
        });

        // Añadir fila de totales
        const totalRow = tbody.insertRow();
        totalRow.style.backgroundColor = '#f0f7ff';
        totalRow.style.fontWeight = 'bold';
        totalRow.innerHTML = `
            <td><strong>TOTALES</strong></td>
            <td><strong>${(totalCuentas + totalEfectivo).toFixed(2)} €</strong></td>
            <td colspan="2"></td>
            <td></td>
        `;

        // Añadir subtotales
        const subtotalRow = tbody.insertRow();
        subtotalRow.innerHTML = `
            <td style="padding-left:20px;">→ Total en Cuentas</td>
            <td>${totalCuentas.toFixed(2)} €</td>
            <td colspan="3"></td>
        `;

        const subtotalRow2 = tbody.insertRow();
        subtotalRow2.innerHTML = `
            <td style="padding-left:20px;">→ Total en Efectivo</td>
            <td>${totalEfectivo.toFixed(2)} €</td>
            <td colspan="3"></td>
        `;
    },

    deleteInitialBalance: function (descripcion, importe, forma, year) {
        if (!confirm('¿Eliminar este saldo inicial?')) return;

        this.data.saldos_iniciales = this.data.saldos_iniciales.filter(s =>
            !(s.descripcion === descripcion &&
                parseFloat(s.importe) === parseFloat(importe) &&
                s.forma === forma &&
                s.year === year)
        );

        this.nativeSave();
        this.renderInitialBalances();
        alert('Saldo inicial eliminado');
    },

    // --- Cálculo fiscal CORREGIDO según especificaciones ---
    calculateFinancials: function (year) {
        const allMovs = this.expandRecurrentMovements(this.data.movimientos, year);
        const saldosIniciales = (this.data.saldos_iniciales || [])
            .filter(s => s.year === year);

        // Variables para cálculos
        let ingresos = 0,
            ingresosNegocio = 0,
            ingresosPersonales = 0,
            gastos = 0,
            gastosDespacho = 0,
            gastosPersonales = 0;

        let ivaRepercutido = 0,     // IVA que debo (de ingresos)
            ivaSoportado = 0,       // IVA que me descuento (de gastos)
            irpfRetenido = 0,       // IRPF que me retienen (positivo)
            irpfAPagar = 0,         // IRPF que debo pagar (19% de base si no hay retención)
            baseImponibleIngresos = 0,  // Base para calcular IRPF
            baseImponibleGastos = 0;    // Base para deducir IRPF

        let enCuentas = 0,
            enEfectivo = 0;

        // 1. Procesar saldos iniciales
        saldosIniciales.forEach(s => {
            const imp = parseFloat(s.importe) || 0;
            if (s.forma === 'Cuenta') {
                enCuentas += imp;
            } else {
                enEfectivo += imp;
            }
        });

        // 2. Procesar movimientos
        allMovs.forEach(m => {
            if (!m.fecha.startsWith(String(year))) return;

            const imp = parseFloat(m.importe) || 0;
            const ivaSop = parseFloat(m.iva_soportado) || 0;
            const ret = parseFloat(m.retencion) || 0;
            const baseImp = parseFloat(m.base_imponible) || 0;

            if (m.tipo === 'Ingreso') {
                ingresos += imp;

                // Clasificar ingresos
                if (m.con_iva) {
                    ingresosNegocio += imp;

                    // Calcular IVA repercutido (21% sobre base imponible)
                    const base = m.base_imponible || (imp / 1.21);
                    baseImponibleIngresos += base;
                    ivaRepercutido += base * 0.21;

                    // Manejar IRPF
                    if (ret > 0) {
                        // Me retienen IRPF (positivo = me lo quitan)
                        irpfRetenido += ret;
                    } else if (ret < 0) {
                        // Debo pagar IRPF (negativo = lo debo)
                        irpfAPagar += Math.abs(ret);
                    } else {
                        // No especificado: calcular 19% como deuda
                        irpfAPagar += base * 0.19;
                    }
                } else {
                    ingresosPersonales += imp;
                }

                // Actualizar saldos según forma de pago
                if (m.pago === 'Cuenta') enCuentas += imp;
                else enEfectivo += imp;

            } else { // GASTO
                gastos += imp;

                if (m.categoria === 'Gastos Despacho' || m.iva_soportado > 0) {
                    gastosDespacho += imp;

                    // IVA soportado (lo puedo deducir)
                    ivaSoportado += ivaSop;

                    // Base imponible del gasto (deducible en IRPF)
                    baseImponibleGastos += baseImp;

                } else {
                    gastosPersonales += imp;
                }

                // Actualizar saldos según forma de pago
                if (m.pago === 'Cuenta') enCuentas -= imp;
                else enEfectivo -= imp;
            }
        });

        // 3. Calcular resultados finales
        const ivaNeto = ivaRepercutido - ivaSoportado;

        // IRPF neto: lo que me retienen - lo que deduzco de gastos - lo que debo pagar (19% si no hay retención)
        const irpfDeducible = baseImponibleGastos * 0.19; // Lo que puedo deducir de gastos
        const irpfNeto = (irpfRetenido - irpfDeducible) - irpfAPagar;

        // Dinero no disponible por impuestos
        const impuestosPendientes = Math.max(0, ivaNeto) + Math.max(0, irpfNeto);
        const dineroNoDisponible = Math.max(0, impuestosPendientes);

        // ✅ CORRECCIÓN: Dinero disponible real = (Cuentas + Efectivo) - Impuestos Pendientes
        const disponibleReal = (enCuentas + enEfectivo) - dineroNoDisponible;

        return {
            // Totales
            ingresos: parseFloat(ingresos.toFixed(2)),
            ingresosNegocio: parseFloat(ingresosNegocio.toFixed(2)),
            ingresosPersonales: parseFloat(ingresosPersonales.toFixed(2)),
            gastos: parseFloat(gastos.toFixed(2)),
            gastosDespacho: parseFloat(gastosDespacho.toFixed(2)),
            gastosPersonales: parseFloat(gastosPersonales.toFixed(2)),

            // Impuestos
            ivaRepercutido: parseFloat(ivaRepercutido.toFixed(2)),
            ivaSoportado: parseFloat(ivaSoportado.toFixed(2)),
            ivaNeto: parseFloat(ivaNeto.toFixed(2)),

            irpfRetenido: parseFloat(irpfRetenido.toFixed(2)),    // Lo que me retienen
            irpfAPagar: parseFloat(irpfAPagar.toFixed(2)),        // Lo que debo pagar (19%)
            irpfDeducible: parseFloat(irpfDeducible.toFixed(2)),  // Lo que deduzco de gastos
            irpfNeto: parseFloat(irpfNeto.toFixed(2)),            // Resultado final

            // Bases imponibles
            baseImponibleIngresos: parseFloat(baseImponibleIngresos.toFixed(2)),
            baseImponibleGastos: parseFloat(baseImponibleGastos.toFixed(2)),

            // Saldos
            enCuentas: parseFloat(enCuentas.toFixed(2)),
            enEfectivo: parseFloat(enEfectivo.toFixed(2)),

            // Resultados
            disponibleReal: parseFloat(disponibleReal.toFixed(2)),
            dineroNoDisponible: parseFloat(dineroNoDisponible.toFixed(2)),
            impuestosPendientes: parseFloat(impuestosPendientes.toFixed(2))
        };
    },

    getQuarter: function (month) {
        const m = parseInt(month);
        if (m <= 3) return 1;
        if (m <= 6) return 2;
        if (m <= 9) return 3;
        return 4;
    },

    calculateQuarterly: function (year) {
        const allMovs = this.expandRecurrentMovements(this.data.movimientos, year);
        const quarters = { 1: [], 2: [], 3: [], 4: [] };

        // Agrupar movimientos por trimestre
        allMovs.forEach(m => {
            if (m.fecha.startsWith(String(year))) {
                const month = m.fecha.split('-')[1];
                const q = this.getQuarter(month);
                quarters[q].push(m);
            }
        });

        const result = {};
        for (let q = 1; q <= 4; q++) {
            let ingrNegocio = 0, gasDespacho = 0, ivaR = 0, ivaS = 0, irpfRet = 0, irpfDebe = 0;
            let baseIngr = 0, baseGas = 0;

            quarters[q].forEach(m => {
                if (m.tipo === 'Ingreso' && m.con_iva) {
                    ingrNegocio += parseFloat(m.importe) || 0;
                    const base = m.base_imponible || (parseFloat(m.importe) || 0) / 1.21;
                    baseIngr += base;
                    ivaR += base * 0.21;

                    const ret = parseFloat(m.retencion) || 0;
                    if (ret > 0) {
                        irpfRet += ret;
                    } else if (ret < 0) {
                        irpfDebe += Math.abs(ret);
                    } else {
                        irpfDebe += base * 0.19;
                    }
                } else if (m.tipo === 'Gasto' && (m.categoria === 'Gastos Despacho' || m.iva_soportado > 0)) {
                    gasDespacho += parseFloat(m.importe) || 0;
                    ivaS += parseFloat(m.iva_soportado) || 0;
                    baseGas += parseFloat(m.base_imponible) || 0;
                }
            });

            const irpfDeducible = baseGas * 0.19;
            const irpfNeto = (irpfRet - irpfDeducible) - irpfDebe;

            result[`T${q} `] = {
                ingresosNegocio: parseFloat(ingrNegocio.toFixed(2)),
                gastosDespacho: parseFloat(gasDespacho.toFixed(2)),
                resNegocio: parseFloat((ingrNegocio - gasDespacho).toFixed(2)),
                ivaNeto: parseFloat((ivaR - ivaS).toFixed(2)),
                irpfNeto: parseFloat(irpfNeto.toFixed(2))
            };
        }
        return result;
    },

    // ✅ CORRECCIÓN: Mostrar solo movimientos normales, NO saldos iniciales
    renderMonth: function (month) {
        const year = this.currentYear;

        // Procesar pagos recurrentes antes de renderizar
        this.processRecurringDebtPayments(year, month);

        const allMovs = this.expandRecurrentMovements(this.data.movimientos, year);

        // Filtrar movimientos del mes (excluyendo cualquier movimiento especial)
        let monthly = allMovs.filter(m => {
            const [movYear, movMonth] = m.fecha.split('-');
            return movYear === String(year) && movMonth === month;
        });

        // Ordenar por fecha
        monthly.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        const tbody = document.getElementById('mesBody');
        tbody.innerHTML = '';

        monthly.forEach(m => {
            const row = tbody.insertRow();

            // Determinar estilo según tipo
            if (m.tipo === 'Ingreso') {
                if (m.con_iva) {
                    row.style.backgroundColor = '#f0fff4'; // Verde claro para ingresos negocio
                } else {
                    row.style.backgroundColor = '#f7fafc'; // Gris claro para ingresos personales
                }
            } else {
                if (m.categoria === 'Gastos Despacho' || m.iva_soportado > 0) {
                    row.style.backgroundColor = '#fff5f5'; // Rojo claro para gastos negocio
                } else {
                    row.style.backgroundColor = '#f7fafc'; // Gris claro para gastos personales
                }
            }

            row.innerHTML = `
    < td > ${m.fecha}</td >
                <td>${m.concepto} ${m.con_iva ? '(+IVA)' : ''}</td>
                <td>${m.cliente || ''}</td>
                <td>${m.tipo}</td>
                <td>${m.categoria}</td>
                <td>${parseFloat(m.importe).toFixed(2)} €</td>
                <td>${m.pago}</td>
                <td>${(m.iva_soportado || 0).toFixed(2)} €</td>
                <td>${(m.retencion || 0).toFixed(2)} €</td>
                <td><button onclick="App.deleteMovement('${m.fecha}', '${m.concepto.replace(/'/g, "\\'")}', ${m.importe}, '${m.tipo}')" class="btn-delete">🗑️</button></td >
    `;
        });

        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        document.getElementById('mesTitulo').textContent = `${monthNames[parseInt(month) - 1]} ${year} `;

        this.updateDashboard();
        this.updateQuarterlySummary();
    },

    updateDashboard: function () {
        const year = this.currentYear;
        const f = this.calculateFinancials(year);

        // Actualizar panel de control
        document.getElementById('resPersonal').textContent = (f.ingresos - f.gastos).toFixed(2) + ' €';
        document.getElementById('impuestos').textContent = (Math.max(0, f.ivaNeto) + Math.max(0, f.irpfNeto)).toFixed(2) + ' €';
        document.getElementById('dispCuentas').textContent = f.enCuentas.toFixed(2) + ' €';
        document.getElementById('dispEfectivo').textContent = f.enEfectivo.toFixed(2) + ' €';
        document.getElementById('ivaNeto').textContent = f.ivaNeto.toFixed(2) + ' €';
        document.getElementById('irpfNeto').textContent = f.irpfNeto.toFixed(2) + ' €';
        document.getElementById('dineroDisponibleReal').textContent = f.disponibleReal.toFixed(2) + ' €';

        // Actualizar resumen anual
        document.getElementById('anualIngresosTot').textContent = f.ingresos.toFixed(2) + ' €';
        document.getElementById('anualGastosTot').textContent = f.gastos.toFixed(2) + ' €';
        document.getElementById('anualResPersonal').textContent = (f.ingresos - f.gastos).toFixed(2) + ' €';
        document.getElementById('anualCuentas').textContent = f.enCuentas.toFixed(2) + ' €';
        document.getElementById('anualEfectivo').textContent = f.enEfectivo.toFixed(2) + ' €';
        document.getElementById('anualIngresosD').textContent = f.ingresosNegocio.toFixed(2) + ' €';
        document.getElementById('anualGastosD').textContent = f.gastosDespacho.toFixed(2) + ' €';
        document.getElementById('anualResNegocio').textContent = (f.ingresosNegocio - f.gastosDespacho).toFixed(2) + ' €';
        document.getElementById('anualIVANeto').textContent = f.ivaNeto.toFixed(2) + ' €';
        document.getElementById('anualIRPFNeto').textContent = f.irpfNeto.toFixed(2) + ' €';

        // Actualizar título del dashboard
        document.getElementById('dashboardMonthTitle').textContent = document.getElementById('mesTitulo').textContent;
    },

    updateQuarterlySummary: function () {
        const year = this.currentYear;
        const quarters = this.calculateQuarterly(year);
        const tbody = document.getElementById('resumenTrimestral').querySelector('tbody');
        tbody.innerHTML = '';

        for (let q = 1; q <= 4; q++) {
            const data = quarters[`T${q} `];
            const row = tbody.insertRow();
            row.innerHTML = `
    < td > <strong>T${q}</strong></td >
                <td>${data.ingresosNegocio.toFixed(2)} €</td>
                <td>${data.gastosDespacho.toFixed(2)} €</td>
                <td>${data.resNegocio.toFixed(2)} €</td>
                <td>${data.ivaNeto.toFixed(2)} €</td>
                <td>${data.irpfNeto.toFixed(2)} €</td>
`;

            // Resaltar fila del trimestre actual
            const currentQuarter = this.getQuarter(this.currentMonth);
            if (q === currentQuarter) {
                row.style.backgroundColor = '#ebf8ff';
                row.style.fontWeight = 'bold';
            }
        }
    },

    payTaxes: function () {
        const year = this.currentYear;
        const f = this.calculateFinancials(year);
        const ivaAPagar = Math.max(0, f.ivaNeto);
        const irpfAPagar = Math.max(0, f.irpfNeto);
        const total = ivaAPagar + irpfAPagar;

        if (total <= 0) {
            alert('No hay impuestos pendientes de pago.');
            return;
        }

        if (!confirm(`¿Registrar pago de impuestos ?\n\nIVA: ${ivaAPagar.toFixed(2)} €\nIRPF: ${irpfAPagar.toFixed(2)} €\nTOTAL: ${total.toFixed(2)} €`)) return;

        const today = new Date();
        const fecha = today.toISOString().split('T')[0];
        const quarter = this.getQuarter(this.currentMonth);

        this.data.movimientos.push({
            fecha,
            concepto: `Pago Impuestos T${quarter} - ${year} `,
            cliente: 'Hacienda',
            tipo: 'Gasto',
            categoria: 'Impuestos',
            importe: total,
            pago: 'Cuenta',
            iva_soportado: 0,
            retencion: 0,
            base_imponible: 0,
            con_iva: false,
            recurrente: false,
            fecha_registro: new Date().toISOString()
        });

        this.nativeSave();
        this.renderMonth(this.currentMonth);
        alert(`Pago de impuestos registrado: ${total.toFixed(2)} €`);
    },

    // --- Debt Management ---
    addDebt: function () {
        const acreedor = document.getElementById('debtAcreedor').value.trim();
        const descripcion = document.getElementById('debtDescripcion').value.trim();
        const importeInput = document.getElementById('debtImporte').value;
        const pagoMensualInput = document.getElementById('debtPagoMensual').value;
        const diaCobroInput = document.getElementById('debtDiaCobro').value;
        const fechaInicio = document.getElementById('debtFechaInicio').value;

        // Validaciones
        if (!acreedor) {
            alert('El acreedor es obligatorio');
            return;
        }

        if (!descripcion) {
            alert('La descripción es obligatoria');
            return;
        }

        if (!importeInput || isNaN(parseFloat(importeInput)) || parseFloat(importeInput) <= 0) {
            alert('El importe debe ser un número positivo válido');
            return;
        }

        const importe = parseFloat(importeInput);
        const pagoMensual = pagoMensualInput ? parseFloat(pagoMensualInput) : 0;
        const diaCobro = diaCobroInput ? parseInt(diaCobroInput) : 5;

        // Generar ID único
        const id = Date.now().toString();

        const nuevaDeuda = {
            id,
            acreedor,
            descripcion,
            importe_total: importe,
            importe_pagado: 0,
            pago_mensual_recurrente: pagoMensual,
            dia_cobro: diaCobro,
            fecha_inicio: fechaInicio || new Date().toISOString().split('T')[0],
            fecha_registro: new Date().toISOString()
        };

        this.data.deudas.push(nuevaDeuda);

        // Guardar inmediatamente
        this.nativeSave();

        // Actualizar interfaz
        this.renderDebts();

        // Limpiar formulario
        document.getElementById('debtAcreedor').value = '';
        document.getElementById('debtDescripcion').value = '';
        document.getElementById('debtImporte').value = '';
        document.getElementById('debtPagoMensual').value = '';
        document.getElementById('debtDiaCobro').value = '';
        document.getElementById('debtFechaInicio').value = '';

        alert('Deuda registrada correctamente');
    },

    renderDebts: function () {
        const tbody = document.getElementById('debtsBody');
        tbody.innerHTML = '';

        if (!this.data.deudas || this.data.deudas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#666;">No hay deudas registradas</td></tr>';
            document.getElementById('totalDeudas').textContent = '0.00 €';
            return;
        }

        let totalPendiente = 0;

        this.data.deudas.forEach(deuda => {
            const row = tbody.insertRow();
            const total = parseFloat(deuda.importe_total) || 0;
            const pagado = parseFloat(deuda.importe_pagado) || 0;
            const pendiente = total - pagado;
            const pagoMensual = parseFloat(deuda.pago_mensual_recurrente) || 0;

            totalPendiente += pendiente;

            // Color de fondo según estado
            if (pendiente <= 0) {
                row.style.backgroundColor = '#f0fff4'; // Verde claro - pagada
            } else if (pagoMensual > 0) {
                row.style.backgroundColor = '#fff5f5'; // Rojo claro - con pago recurrente
            }

            row.innerHTML = `
    < td > ${deuda.acreedor}</td >
                <td>${deuda.descripcion}</td>
                <td>${total.toFixed(2)} €</td>
                <td>${pagado.toFixed(2)} €</td>
                <td><strong>${pendiente.toFixed(2)} €</strong></td>
                <td>${pagoMensual > 0 ? pagoMensual.toFixed(2) + ' €/mes' : '-'}</td>
                <td>
                    ${pendiente > 0 ? `<button onclick="App.showPayDebtDialog('${deuda.id}')" class="btn-save" style="font-size:12px; padding:4px 8px;">💰 Pagar</button>` : ''}
                    <button onclick="App.deleteDebt('${deuda.id}')" class="btn-delete" style="font-size:12px; padding:4px 8px;">🗑️</button>
                </td>
`;
        });

        // Actualizar total en dashboard
        document.getElementById('totalDeudas').textContent = totalPendiente.toFixed(2) + ' €';
    },

    showPayDebtDialog: function (debtId) {
        const deuda = this.data.deudas.find(d => d.id === debtId);
        if (!deuda) {
            alert('Deuda no encontrada');
            return;
        }

        const pendiente = deuda.importe_total - deuda.importe_pagado;
        const monto = prompt(`Pagar deuda: ${deuda.descripcion} \nAcreedor: ${deuda.acreedor} \nPendiente: ${pendiente.toFixed(2)} €\n\n¿Cuánto desea pagar ? `);

        if (monto === null) return; // Cancelado

        const montoNum = parseFloat(monto);
        if (isNaN(montoNum) || montoNum <= 0) {
            alert('El monto debe ser un número positivo');
            return;
        }

        if (montoNum > pendiente) {
            alert('El monto no puede ser mayor que el pendiente');
            return;
        }

        this.payDebt(debtId, montoNum);
    },

    payDebt: function (debtId, monto) {
        const deuda = this.data.deudas.find(d => d.id === debtId);
        if (!deuda) {
            alert('Deuda no encontrada');
            return;
        }

        // Actualizar deuda
        deuda.importe_pagado += monto;

        // Registrar como gasto
        const today = new Date();
        const fecha = today.toISOString().split('T')[0];

        this.data.movimientos.push({
            fecha,
            concepto: `Pago Deuda: ${deuda.descripcion} `,
            cliente: deuda.acreedor,
            tipo: 'Gasto',
            categoria: 'Pago Deuda',
            importe: monto,
            pago: 'Cuenta',
            iva_soportado: 0,
            retencion: 0,
            base_imponible: 0,
            con_iva: false,
            recurrente: false,
            debt_id: debtId, // Vincular con la deuda
            fecha_registro: new Date().toISOString()
        });

        // Guardar
        this.nativeSave();

        // Actualizar interfaz
        this.renderDebts();
        this.renderMonth(this.currentMonth);
        this.updateDashboard();

        const pendiente = deuda.importe_total - deuda.importe_pagado;
        if (pendiente <= 0.01) {
            alert(`¡ENHORABUENA! La deuda "${deuda.descripcion}" ha sido pagada POR COMPLETO.\nya puedes eliminarla de la lista.`);
        } else {
            alert(`Pago registrado: ${monto.toFixed(2)} €\nPendiente: ${pendiente.toFixed(2)} €`);
        }
    },

    deleteDebt: function (debtId) {
        const deuda = this.data.deudas.find(d => d.id === debtId);
        if (!deuda) return;

        if (!confirm(`¿Eliminar deuda "${deuda.descripcion}" de ${deuda.acreedor}?`)) return;

        // Eliminar deuda
        this.data.deudas = this.data.deudas.filter(d => d.id !== debtId);

        // Guardar
        this.nativeSave();

        // Actualizar interfaz
        this.renderDebts();

        alert('Deuda eliminada');
    },

    // Procesar pagos recurrentes de deudas (llamar al inicio de cada mes)
    processRecurringDebtPayments: function (year, month) {
        if (!this.data.deudas) return;
        let paymentsMade = false;

        this.data.deudas.forEach(deuda => {
            if (!deuda.pago_mensual_recurrente || deuda.pago_mensual_recurrente <= 0) return;

            const pendiente = deuda.importe_total - deuda.importe_pagado;
            if (pendiente <= 0) return;

            // Verificar si ya existe un pago para este mes
            const yearMonth = `${year} -${month} `;

            // Si el usuario lo borró explícitamente en esta sesión, no re-añadir
            if (this.deleted_recurring_tracker.includes(`${deuda.id}| ${yearMonth} `)) return;

            const existePago = this.data.movimientos.some(m =>
                m.debt_id === deuda.id &&
                m.fecha.startsWith(yearMonth) &&
                m.concepto.includes('Pago Recurrente')
            );

            if (existePago) return;

            // Verificar si estamos en o después de la fecha de inicio
            const fechaInicio = new Date(deuda.fecha_inicio);
            const fechaActual = new Date(year, parseInt(month) - 1, (deuda.dia_cobro || 5));
            if (fechaActual < fechaInicio) return;

            // Calcular monto a pagar (no exceder pendiente)
            const montoPago = Math.min(deuda.pago_mensual_recurrente, pendiente);

            // Crear pago automático con el día específico
            const diaEscogido = String(deuda.dia_cobro || 5).padStart(2, '0');
            const fecha = `${year} -${month} -${diaEscogido} `;
            this.data.movimientos.push({
                fecha,
                concepto: `Pago Recurrente Deuda: ${deuda.descripcion} `,
                cliente: deuda.acreedor,
                tipo: 'Gasto',
                categoria: 'Pago Deuda',
                importe: montoPago,
                pago: 'Cuenta',
                iva_soportado: 0,
                retencion: 0,
                base_imponible: 0,
                con_iva: false,
                recurrente: false,
                debt_id: deuda.id,
                is_recurring_debt: true,
                fecha_registro: new Date().toISOString()
            });

            // Actualizar deuda
            deuda.importe_pagado += montoPago;
            paymentsMade = true;

            if ((deuda.importe_total - deuda.importe_pagado) <= 0.01) {
                alert(`¡DEUDA FINALIZADA! La deuda "${deuda.descripcion}" con ${deuda.acreedor} ha terminado de pagarse este mes.`);
            }
        });

        if (paymentsMade) {
            this.nativeSave();
            this.renderDebts();
            this.renderMonth(this.currentMonth);
            this.updateDashboard();
        }
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => App.init());
