class PingWiseDashboard {
    constructor() {
        this.socket = null;
        this.charts = {};
        this.currentTimeRange = '1min';
        this.currentServer = 'Auto';
        this.connectionStatus = 'connecting';
        
        this.init();
    }
    
    init() {
        this.initializeSocket();
        this.initializeCharts();
        this.initializeEventListeners();
        this.initializeGauge();
        this.createConnectionIndicator();
        this.loadInitialData();
    }
    
    createConnectionIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'connectionStatus';
        indicator.className = 'connection-status connecting';
        indicator.textContent = 'Connecting...';
        document.body.appendChild(indicator);
    }
    
    updateConnectionStatus(status) {
        const indicator = document.getElementById('connectionStatus');
        if (!indicator) return;
        
        this.connectionStatus = status;
        indicator.className = `connection-status ${status}`;
        
        switch(status) {
            case 'connected':
                indicator.textContent = 'Connected';
                break;
            case 'disconnected':
                indicator.textContent = 'Disconnected';
                break;
            case 'connecting':
                indicator.textContent = 'Connecting...';
                break;
        }
        
        // Auto-hide after 3 seconds if connected
        if (status === 'connected') {
            setTimeout(() => {
                indicator.style.opacity = '0';
                setTimeout(() => {
                    if (indicator.style.opacity === '0') {
                        indicator.style.display = 'none';
                    }
                }, 300);
            }, 3000);
        } else {
            indicator.style.display = 'block';
            indicator.style.opacity = '1';
        }
    }
    
    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus('connected');
            this.socket.emit('subscribe_updates');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus('disconnected');
        });
        
        this.socket.on('network_update', (data) => {
            this.updateRealTimeData(data);
        });
        
        this.socket.on('historical_data', (data) => {
            this.updateCharts(data);
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.updateConnectionStatus('disconnected');
        });
        
        this.socket.on('subscribed', (data) => {
            console.log('Subscribed to updates:', data.message);
        });
    }
    
    initializeEventListeners() {
        // Time range buttons
        document.querySelectorAll('.pill').forEach(button => {
            button.addEventListener('click', (e) => {
                const range = e.target.textContent.trim();
                this.changeTimeRange(range);
            });
        });
        
        // Server selection
        const serverSelect = document.querySelector('select');
        if (serverSelect) {
            serverSelect.addEventListener('change', (e) => {
                this.changeServer(e.target.value);
            });
        }
        
        // Manage buttons
        document.querySelectorAll('.btn-manage').forEach(button => {
            button.addEventListener('click', (e) => {
                const card = e.target.closest('[id^="cardLag"]');
                if (card) {
                    this.toggleManagePanel(card);
                }
            });
        });
        
        // Start button
        const startButton = document.querySelector('.btn-aurora');
        if (startButton) {
            startButton.addEventListener('click', () => {
                this.startMonitoring();
            });
        }
    }
    
    changeTimeRange(range) {
        // Update active state
        document.querySelectorAll('.pill').forEach(btn => {
            btn.classList.remove('active', 'bg-white/10');
        });
        
        const activeButton = Array.from(document.querySelectorAll('.pill'))
            .find(btn => btn.textContent.trim() === range);
        if (activeButton) {
            activeButton.classList.add('active', 'bg-white/10');
        }
        
        // Convert range to API format
        const rangeMap = {
            '1 min': '1min',
            '5 min': '5min', 
            '1 hour': '1hour',
            '24 hours': '24hours'
        };
        
        this.currentTimeRange = rangeMap[range] || '1min';
        
        if (this.socket && this.socket.connected) {
            this.socket.emit('change_time_range', { range: this.currentTimeRange });
        }
        
        this.loadHistoricalData();
    }
    
    changeServer(server) {
        this.currentServer = server;
        
        if (this.socket && this.socket.connected) {
            this.socket.emit('change_server', { server: server });
        }
        
        console.log(`Server changed to: ${server}`);
    }
    
    toggleManagePanel(card) {
        const cardId = card.id;
        const panelId = cardId.replace('cardLag', 'panel');
        const panel = document.getElementById(panelId);
        
        if (panel) {
            panel.classList.toggle('hidden');
            panel.classList.toggle('panel-transition');
            panel.classList.toggle('open');
        }
    }
    
    startMonitoring() {
        console.log('Starting network monitoring...');
        // In a real implementation, this would trigger the monitoring process
        // For now, we'll just show a message
        const button = document.querySelector('.btn-aurora');
        if (button) {
            const originalText = button.textContent;
            button.textContent = 'Running...';
            button.disabled = true;
            
            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
            }, 2000);
        }
    }
    
    initializeCharts() {
        // Initialize download throughput chart
        const downloadChart = document.getElementById('chartDownTop');
        if (downloadChart) {
            this.charts.download = echarts.init(downloadChart);
            this.setupThroughputChart(this.charts.download, 'download');
        }
        
        // Initialize upload throughput chart
        const uploadChart = document.getElementById('chartUpTop');
        if (uploadChart) {
            this.charts.upload = echarts.init(uploadChart);
            this.setupThroughputChart(this.charts.upload, 'upload');
        }
        
        // Initialize RTT chart
        const rttChart = document.getElementById('chartRTT');
        if (rttChart) {
            this.charts.rtt = echarts.init(rttChart);
            this.setupRTTChart(this.charts.rtt);
        }
        
        // Handle window resize
        window.addEventListener('resize', () => {
            Object.values(this.charts).forEach(chart => {
                if (chart) chart.resize();
            });
        });
    }
    
    setupThroughputChart(chart, type) {
        const option = {
            grid: {
                left: 0,
                right: 0,
                top: 5,
                bottom: 5
            },
            xAxis: {
                type: 'category',
                show: false,
                data: []
            },
            yAxis: {
                type: 'value',
                show: false
            },
            series: [{
                type: 'line',
                smooth: true,
                symbol: 'none',
                lineStyle: {
                    width: 2,
                    color: type === 'download' ? '#FF8BA7' : '#FFD59E'
                },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [{
                            offset: 0,
                            color: type === 'download' ? 'rgba(255,139,167,0.3)' : 'rgba(255,213,158,0.3)'
                        }, {
                            offset: 1,
                            color: type === 'download' ? 'rgba(255,139,167,0.05)' : 'rgba(255,213,158,0.05)'
                        }]
                    }
                },
                data: []
            }]
        };
        
        chart.setOption(option);
    }
    
    setupRTTChart(chart) {
        const option = {
            grid: {
                left: 40,
                right: 20,
                top: 20,
                bottom: 30
            },
            xAxis: {
                type: 'category',
                axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
                axisLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
                data: []
            },
            yAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
                axisLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
            },
            series: [
                {
                    name: 'Router RTT',
                    type: 'line',
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 4,
                    lineStyle: { width: 2, color: '#FF8BA7' },
                    itemStyle: { color: '#FF8BA7' },
                    data: []
                },
                {
                    name: 'Internet RTT',
                    type: 'line',
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 4,
                    lineStyle: { width: 2, color: '#FFD59E' },
                    itemStyle: { color: '#FFD59E' },
                    data: []
                }
            ],
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(21,9,14,0.9)',
                borderColor: 'rgba(255,255,255,0.1)',
                textStyle: { color: '#fff' }
            }
        };
        
        chart.setOption(option);
    }
    
    initializeGauge() {
        const svg = document.getElementById('nanoGauge');
        if (!svg) return;
        
        // Create hexagonal gauge path
        this.updateGauge(85); // Initial score
    }
    
    updateGauge(score) {
        const gaugeFill = document.getElementById('gaugeFill');
        const gaugeOutline = document.getElementById('gaugeOutline');
        const scoreElement = document.getElementById('score');
        
        if (!gaugeFill || !gaugeOutline || !scoreElement) return;
        
        // Create hexagon path
        const centerX = 128;
        const centerY = 128;
        const radius = 80;
        const sides = 6;
        
        let pathData = '';
        for (let i = 0; i <= sides; i++) {
            const angle = (i / sides) * 2 * Math.PI - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            if (i === 0) {
                pathData += `M ${x} ${y}`;
            } else {
                pathData += ` L ${x} ${y}`;
            }
        }
        pathData += ' Z';
        
        gaugeFill.setAttribute('d', pathData);
        gaugeOutline.setAttribute('d', pathData);
        scoreElement.textContent = score;
        
        // Update color based on score
        const scoreElement2 = document.getElementById('score');
        if (scoreElement2) {
            if (score >= 80) {
                scoreElement2.className = 'text-7xl font-extrabold text-mint drop-shadow';
            } else if (score >= 60) {
                scoreElement2.className = 'text-7xl font-extrabold text-amber drop-shadow';
            } else {
                scoreElement2.className = 'text-7xl font-extrabold text-danger drop-shadow';
            }
        }
    }
    
    updateRealTimeData(data) {
        // Update gauge
        this.updateGauge(data.score);
        
        // Update status text
        const statusHead = document.getElementById('statusHead');
        const statusSub = document.getElementById('statusSub');
        
        if (data.score >= 80) {
            if (statusHead) statusHead.textContent = 'Excellent Performance';
            if (statusSub) statusSub.textContent = 'Your connection is performing exceptionally well with fast speeds and low latency.';
        } else if (data.score >= 60) {
            if (statusHead) statusHead.textContent = 'Good Performance';
            if (statusSub) statusSub.textContent = 'Your connection is working well with minor fluctuations in performance.';
        } else if (data.score >= 40) {
            if (statusHead) statusHead.textContent = 'Fair Performance';
            if (statusSub) statusSub.textContent = 'Your connection has some performance issues that may affect usage.';
        } else {
            if (statusHead) statusHead.textContent = 'Poor Performance';
            if (statusSub) statusSub.textContent = 'Your connection is experiencing significant problems.';
        }
        
        // Update throughput displays
        const dlTopNow = document.getElementById('dlTopNow');
        const ulTopNow = document.getElementById('ulTopNow');
        if (dlTopNow) dlTopNow.textContent = Math.round(data.download_speed);
        if (ulTopNow) ulTopNow.textContent = Math.round(data.upload_speed);
        
        // Update RTT displays
        const rttRouter = document.getElementById('rttRouter');
        const rttInternet = document.getElementById('rttInternet');
        if (rttRouter) rttRouter.textContent = `${Math.round(data.router_rtt)} ms`;
        if (rttInternet) rttInternet.textContent = `${Math.round(data.internet_rtt)} ms`;
        
        // Update responsiveness score
        const respScore = document.getElementById('respScore');
        if (respScore) {
            const responsiveness = Math.max(0, 100 - (data.internet_rtt - 20) * 2);
            respScore.textContent = Math.round(responsiveness);
        }
        
        // Update detailed metrics
        this.updateDetailedMetrics(data);
        
        // Update charts with new data point
        this.addDataPointToCharts(data);
    }
    
    updateDetailedMetrics(data) {
        // Router metrics
        const elements = {
            'rAvg': `${Math.round(data.router_rtt)} ms`,
            'rBest': `${Math.round(data.router_rtt * 0.7)} ms`,
            'rWorst': `${Math.round(data.router_rtt * 1.5)} ms`,
            'rLat': `${Math.round(data.router_rtt * 0.8)} ms`,
            'rJit': `${Math.round(data.jitter)} ms`,
            'rLoss': `${data.packet_loss.toFixed(1)} %`,
            
            // Internet metrics
            'iAvg': `${Math.round(data.internet_rtt)} ms`,
            'iBest': `${Math.round(data.internet_rtt * 0.8)} ms`,
            'iWorst': `${Math.round(data.internet_rtt * 1.3)} ms`,
            'iLat': `${Math.round(data.internet_rtt * 0.9)} ms`,
            'iJit': `${Math.round(data.jitter * 1.2)} ms`,
            'iLoss': `${(data.packet_loss * 0.8).toFixed(1)} %`
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }
    
    addDataPointToCharts(data) {
        const timestamp = new Date(data.timestamp).toLocaleTimeString();
        
        // Update download chart
        if (this.charts.download) {
            const option = this.charts.download.getOption();
            const xData = option.xAxis[0].data;
            const seriesData = option.series[0].data;
            
            xData.push(timestamp);
            seriesData.push(data.download_speed);
            
            // Keep only last 20 points for real-time view
            if (xData.length > 20) {
                xData.shift();
                seriesData.shift();
            }
            
            this.charts.download.setOption({
                xAxis: { data: xData },
                series: [{ data: seriesData }]
            });
        }
        
        // Update upload chart
        if (this.charts.upload) {
            const option = this.charts.upload.getOption();
            const xData = option.xAxis[0].data;
            const seriesData = option.series[0].data;
            
            xData.push(timestamp);
            seriesData.push(data.upload_speed);
            
            if (xData.length > 20) {
                xData.shift();
                seriesData.shift();
            }
            
            this.charts.upload.setOption({
                xAxis: { data: xData },
                series: [{ data: seriesData }]
            });
        }
        
        // Update RTT chart
        if (this.charts.rtt) {
            const option = this.charts.rtt.getOption();
            const xData = option.xAxis[0].data;
            const routerData = option.series[0].data;
            const internetData = option.series[1].data;
            
            xData.push(timestamp);
            routerData.push(data.router_rtt);
            internetData.push(data.internet_rtt);
            
            if (xData.length > 15) {
                xData.shift();
                routerData.shift();
                internetData.shift();
            }
            
            this.charts.rtt.setOption({
                xAxis: { data: xData },
                series: [
                    { data: routerData },
                    { data: internetData }
                ]
            });
        }
    }
    
    loadInitialData() {
        // Load current status
        fetch('/api/network/status')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error loading status:', data.error);
                    return;
                }
                this.updateRealTimeData(data);
            })
            .catch(error => {
                console.error('Error fetching initial status:', error);
            });
        
        // Load historical data
        this.loadHistoricalData();
    }
    
    loadHistoricalData() {
        fetch(`/api/network/history?range=${this.currentTimeRange}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error loading history:', data.error);
                    return;
                }
                this.updateCharts(data);
            })
            .catch(error => {
                console.error('Error fetching historical data:', error);
            });
    }
    
    updateCharts(historyData) {
        const data = historyData.data || [];
        
        // Prepare data for charts
        const timestamps = data.map(point => {
            const date = new Date(point.timestamp);
            return date.toLocaleTimeString();
        });
        
        const downloadSpeeds = data.map(point => point.download_speed);
        const uploadSpeeds = data.map(point => point.upload_speed);
        const routerRTTs = data.map(point => point.router_rtt);
        const internetRTTs = data.map(point => point.internet_rtt);
        
        // Update download chart
        if (this.charts.download) {
            this.charts.download.setOption({
                xAxis: { data: timestamps },
                series: [{ data: downloadSpeeds }]
            });
        }
        
        // Update upload chart
        if (this.charts.upload) {
            this.charts.upload.setOption({
                xAxis: { data: timestamps },
                series: [{ data: uploadSpeeds }]
            });
        }
        
        // Update RTT chart
        if (this.charts.rtt) {
            this.charts.rtt.setOption({
                xAxis: { data: timestamps },
                series: [
                    { data: routerRTTs },
                    { data: internetRTTs }
                ]
            });
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new PingWiseDashboard();
});
