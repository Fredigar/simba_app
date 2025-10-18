/**
 * ChartGenerator.js - Librería para crear gráficas desde tablas HTML
 * Requiere Chart.js 3.x para funcionar
 *
 * Uso básico:
 * const chartGen = new ChartGenerator();
 * chartGen.createChart('miTabla', 'miDiv');
 *
 * @author Tu nombre
 * @version 1.0.0
 */

class ChartGenerator {
    constructor() {
        this.charts = {};
        this.colors = [
            '#667eea', '#764ba2', '#f093fb', '#f5576c',
            '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
            '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3'
        ];
    }

    /**
     * Método principal para crear gráficas desde tablas HTML
     * @param {string} tableId - ID de la tabla HTML
     * @param {string} divDestino - ID del div donde insertar la gráfica
     * @param {string|null} tipoGrafica - Tipo de gráfica ('auto', 'bar', 'line', 'pie', 'horizontalBar', 'doughnut')
     * @param {string} insertMode - Modo de inserción ('replace', 'append', 'prepend')
     * @param {string|number|Array} seriesConfig - Configuración de series ('auto', 'single', 'all', índice, nombre, array)
     * @returns {Chart} Instancia de Chart.js creada
     */
    createChart(tableId, divDestino, tipoGrafica = null, insertMode = 'replace', seriesConfig = 'auto') {
        try {
            const tableData = this.extractTableData(tableId);

            // Si no especifica tipo o pasa 'auto', elegir automáticamente
            if (!tipoGrafica || tipoGrafica === 'auto') {
                tipoGrafica = this.autoSelectChart(tableData);
                console.log(`🤖 Tipo seleccionado automáticamente: ${tipoGrafica}`);
            }

            // Determinar qué series representar
            const seriesData = this.selectSeries(tableData, seriesConfig);
            console.log(`📊 Series seleccionadas:`, seriesData.map(s => s.name));

            return this.renderChart(tableData, divDestino, tipoGrafica, seriesData, insertMode);
        } catch (error) {
            console.error('Error al crear gráfica:', error);
            throw error;
        }
    }

    /**
     * Extrae los datos de una tabla HTML
     * @param {string} tableId - ID de la tabla
     * @returns {Object} Objeto con headers y data
     */
    extractTableData(tableId) {
        const table = document.getElementById(tableId);
        if (!table) {
            throw new Error(`Tabla con ID '${tableId}' no encontrada`);
        }

        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
        const rows = Array.from(table.querySelectorAll('tbody tr'));

        if (headers.length === 0) {
            throw new Error('La tabla debe tener encabezados (thead > th)');
        }

        if (rows.length === 0) {
            throw new Error('La tabla debe tener datos (tbody > tr)');
        }

        return {
            headers: headers,
            data: rows.map(row =>
                Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim())
            )
        };
    }

    /**
     * Selecciona automáticamente el tipo de gráfica más adecuado
     * @param {Object} tableData - Datos de la tabla
     * @returns {string} Tipo de gráfica recomendado
     */
    autoSelectChart(tableData) {
        const numCols = tableData.headers.length;
        const numRows = tableData.data.length;

        // Detectar datos temporales
        const hasTimeData = tableData.data.some(row =>
            /\d{4}|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|q1|q2|q3|q4/i.test(row[0])
        );

        // Reglas de selección automática
        if (hasTimeData && numCols >= 2) {
            return 'line'; // Datos temporales -> línea
        }
        if (numRows <= 5 && numCols === 2) {
            return 'doughnut'; // Pocas categorías -> dona
        }
        if (numRows > 8) {
            return 'horizontalBar'; // Muchas filas -> barras horizontales
        }

        return 'bar'; // Por defecto barras
    }

    /**
     * Determina qué series representar basado en la configuración
     * @param {Object} tableData - Datos de la tabla
     * @param {string|number|Array} seriesConfig - Configuración de series
     * @returns {Array} Array de objetos con información de las series
     */
    selectSeries(tableData, seriesConfig) {
        const numericCols = [];

        // Encontrar todas las columnas numéricas (excluyendo la primera que suele ser labels)
        for (let i = 1; i < tableData.headers.length; i++) {
            const isNumeric = tableData.data.every(row => {
                const cleaned = row[i].replace(/[^\d.-]/g, '');
                return !isNaN(parseFloat(cleaned)) && cleaned !== '';
            });

            if (isNumeric) {
                numericCols.push({
                    index: i,
                    name: tableData.headers[i],
                    data: tableData.data.map(row => parseFloat(row[i].replace(/[^\d.-]/g, '')))
                });
            }
        }

        if (numericCols.length === 0) {
            throw new Error('No se encontraron columnas numéricas en la tabla');
        }

        // Configuración de series
        switch (seriesConfig) {
            case 'auto':
                // Auto: Si hay múltiples columnas numéricas, usar todas; si solo hay una, usarla
                return numericCols.length > 1 ? numericCols : [numericCols[0]];

            case 'single':
                // Single: Solo la primera columna numérica
                return [numericCols[0]];

            case 'all':
                // All: Todas las columnas numéricas
                return numericCols;

            default:
                if (Array.isArray(seriesConfig)) {
                    // Array específico: [1, 2] o ['Ventas 2023', 'Ventas 2024']
                    return seriesConfig.map(config => {
                        if (typeof config === 'number') {
                            return numericCols.find(col => col.index === config);
                        } else {
                            return numericCols.find(col => col.name === config);
                        }
                    }).filter(Boolean);
                } else if (typeof seriesConfig === 'number') {
                    // Índice específico
                    const found = numericCols.find(col => col.index === seriesConfig);
                    return found ? [found] : [numericCols[0]];
                } else if (typeof seriesConfig === 'string') {
                    // Nombre específico
                    const found = numericCols.find(col => col.name === seriesConfig);
                    return found ? [found] : [numericCols[0]];
                }
        }

        // Fallback: primera columna numérica
        return [numericCols[0]];
    }

    /**
     * Renderiza la gráfica con Chart.js
     * @param {Object} tableData - Datos de la tabla
     * @param {string} divDestino - ID del div destino
     * @param {string} tipoGrafica - Tipo de gráfica
     * @param {Array} seriesData - Datos de las series
     * @param {string} insertMode - Modo de inserción
     * @returns {Chart} Instancia de Chart.js
     */
    renderChart(tableData, divDestino, tipoGrafica, seriesData, insertMode = 'replace') {
        // Verificar que Chart.js está disponible
        if (typeof Chart === 'undefined') {
            throw new Error('Chart.js no está cargado. Asegúrate de incluir Chart.js antes de usar ChartGenerator.');
        }

        // Generar ID único para el canvas
        const canvasId = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const canvasHTML = `<div class="chart-wrapper" style="height: 400px; margin: 20px 0; position: relative;"><canvas id="${canvasId}"></canvas></div>`;

        const container = document.getElementById(divDestino);
        if (!container) {
            throw new Error(`Contenedor con ID '${divDestino}' no encontrado`);
        }

        // Aplicar modo de inserción
        switch(insertMode) {
            case 'append':
                container.insertAdjacentHTML('beforeend', canvasHTML);
                break;
            case 'prepend':
                container.insertAdjacentHTML('afterbegin', canvasHTML);
                break;
            case 'replace':
            default:
                // Destruir gráficas anteriores en este contenedor
                this.destroyChartsInContainer(divDestino);
                container.innerHTML = canvasHTML;
                break;
        }

        const labels = tableData.data.map(row => row[0]);

        // Preparar datasets para multiseries
        const datasets = seriesData.map((serie, index) => {
            const colorIndex = index % this.colors.length;
            return {
                label: serie.name,
                data: serie.data,
                backgroundColor: tipoGrafica === 'pie' || tipoGrafica === 'doughnut' ?
                    this.colors.slice(0, labels.length) :
                    this.hexToRgba(this.colors[colorIndex], tipoGrafica === 'line' ? 0.2 : 0.8),
                borderColor: this.colors[colorIndex],
                borderWidth: tipoGrafica === 'line' ? 3 : 2,
                fill: tipoGrafica === 'line' ? false : true,
                tension: tipoGrafica === 'line' ? 0.4 : 0,
                pointBackgroundColor: tipoGrafica === 'line' ? this.colors[colorIndex] : undefined,
                pointBorderColor: tipoGrafica === 'line' ? this.colors[colorIndex] : undefined,
                pointRadius: tipoGrafica === 'line' ? 5 : undefined
            };
        });

        // Para pie/doughnut con multiseries, solo usar la primera serie
        const finalDatasets = (tipoGrafica === 'pie' || tipoGrafica === 'doughnut') ?
            [{
                ...datasets[0],
                backgroundColor: this.colors.slice(0, labels.length)
            }] : datasets;

        const config = {
            type: tipoGrafica === 'horizontalBar' ? 'bar' : tipoGrafica,
            data: {
                labels: labels,
                datasets: finalDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: tipoGrafica === 'horizontalBar' ? 'y' : 'x',
                plugins: {
                    title: {
                        display: true,
                        text: seriesData.length > 1 ?
                            `${seriesData.map(s => s.name).join(' vs ')} por ${tableData.headers[0]}` :
                            `${seriesData[0].name} por ${tableData.headers[0]}`,
                        font: { size: 16, weight: 'bold' },
                        padding: 20
                    },
                    legend: {
                        display: seriesData.length > 1 || tipoGrafica === 'pie' || tipoGrafica === 'doughnut',
                        position: 'top',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        cornerRadius: 8
                    }
                },
                scales: tipoGrafica === 'pie' || tipoGrafica === 'doughnut' ? {} : {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.1)' },
                        ticks: { font: { size: 12 } }
                    },
                    x: {
                        grid: { color: 'rgba(0,0,0,0.1)' },
                        ticks: { font: { size: 12 } }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        };

        const ctx = document.getElementById(canvasId).getContext('2d');
        const chart = new Chart(ctx, config);

        // Guardar referencia de la gráfica con su contenedor
        this.charts[canvasId] = {
            chart: chart,
            container: divDestino,
            tableId: tableData.tableId || 'unknown'
        };

        return chart;
    }

    /**
     * Convierte color hex a rgba
     * @param {string} hex - Color en formato hex
     * @param {number} alpha - Valor alpha (0-1)
     * @returns {string} Color en formato rgba
     */
    hexToRgba(hex, alpha = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Destruye todas las gráficas en un contenedor específico
     * @param {string} containerId - ID del contenedor
     */
    destroyChartsInContainer(containerId) {
        Object.keys(this.charts).forEach(chartId => {
            if (this.charts[chartId].container === containerId) {
                this.charts[chartId].chart.destroy();
                delete this.charts[chartId];
            }
        });
    }

    /**
     * Destruye todas las gráficas creadas
     */
    destroyAllCharts() {
        Object.keys(this.charts).forEach(chartId => {
            this.charts[chartId].chart.destroy();
        });
        this.charts = {};
    }

    /**
     * Obtiene una gráfica específica por su ID de canvas
     * @param {string} canvasId - ID del canvas
     * @returns {Chart|null} Instancia de Chart.js o null si no existe
     */
    getChart(canvasId) {
        return this.charts[canvasId]?.chart || null;
    }

    /**
     * Obtiene todas las gráficas activas
     * @returns {Array} Array de instancias de Chart.js
     */
    getAllCharts() {
        return Object.values(this.charts).map(item => item.chart);
    }

    /**
     * Actualiza una gráfica existente con nuevos datos
     * @param {string} canvasId - ID del canvas de la gráfica
     * @param {string} tableId - ID de la nueva tabla
     */
    updateChart(canvasId, tableId) {
        const chartInfo = this.charts[canvasId];
        if (!chartInfo) {
            throw new Error(`Gráfica con ID '${canvasId}' no encontrada`);
        }

        const tableData = this.extractTableData(tableId);
        const chart = chartInfo.chart;

        // Actualizar datos
        chart.data.labels = tableData.data.map(row => row[0]);
        chart.data.datasets[0].data = tableData.data.map(row =>
            parseFloat(row[1].replace(/[^\d.-]/g, ''))
        );

        chart.update();
    }
}

// Exportar para uso en módulos ES6 (opcional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartGenerator;
}

// Hacer disponible globalmente
if (typeof window !== 'undefined') {
    window.ChartGenerator = ChartGenerator;
}