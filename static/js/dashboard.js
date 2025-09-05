// Theme colors for charts (Maroon palette)
const THEME = { 
  rose:'#FF8BA7', 
  blush:'#FFB3C1', 
  plum:'#C6487F', 
  peach:'#FFD59E', 
  grid:'rgba(255,255,255,0.08)', 
  text:'#f1f5f9' 
};

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
        this.initializeGauge();
        this.initializeSocket();
        this.initializeCharts();
        this.initializeEventListeners();
        this.loadInitialData();
    }
    
    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.socket.emit('subscribe_updates');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
        
        this.socket.on('network_update', (data) => {
            this.updateRealTimeData(data);
        });
        
        this.socket.on('historical_data', (data) => {
            this.updateCharts(data);
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
        
        // Ping buttons
        document.querySelectorAll('[data-host]').forEach(btn => {
            btn.addEventListener('click', () => this.runDemoPing(btn.getAttribute('data-host')));
        });
        
        const btnPing = document.getElementById('btnPing');
        if (btnPing) {
            btnPing.addEventListener('click', () => {
                const customHost = document.getElementById('customHost');
                this.runDemoPing(customHost ? customHost.value || '1.1.1.1' : '1.1.1.1');
            });
        }
        
        // Window resize
        window.addEventListener('resize', () => {
            Object.values(this.charts).forEach(chart => {
                if (chart) chart.resize();
            });
        });
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
    }
    
    toggleManagePanel(card) {
        const cardId = card.id;
        const panelId = cardId.replace('cardLag', 'panel');
        const panel = document.getElementById(panelId);
        
        if (panel) {
            panel.classList.toggle('hidden');
        }
    }
    
    initializeCharts() {
        // Delay chart initialization to ensure DOM is ready
        setTimeout(() => {
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
            
            // Initialize Ping chart
            const pingChart = document.getElementById('chartPing');
            if (pingChart) {
                this.charts.ping = echarts.init(pingChart);
                this.setupPingChart(this.charts.ping);
            }
            
            console.log('Charts initialized:', Object.keys(this.charts));
        }, 100);
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
                    color: type === 'download' ? THEME.rose : THEME.peach
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
                    lineStyle: { width: 2, color: THEME.rose },
                    itemStyle: { color: THEME.rose },
                    data: []
                },
                {
                    name: 'Internet RTT',
                    type: 'line',
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 4,
                    lineStyle: { width: 2, color: THEME.peach },
                    itemStyle: { color: THEME.peach },
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
    
    setupPingChart(chart) {
        const option = {
            grid: {
                left: 40,
                right: 20,
                top: 10,
                bottom: 30
            },
            xAxis: {
                type: 'category',
                axisLine: { lineStyle: { color: THEME.grid } },
                axisLabel: { color: THEME.text, fontSize: 10 },
                data: []
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: THEME.text, fontSize: 10 },
                splitLine: { lineStyle: { color: THEME.grid } }
            },
            series: [{
                type: 'line',
                data: [],
                smooth: true,
                symbolSize: 6,
                lineStyle: { 
                    width: 3, 
                    color: THEME.rose, 
                    shadowBlur: 12, 
                    shadowColor: 'rgba(255,139,167,.85)' 
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(255,139,167,.32)' },
                        { offset: .6, color: 'rgba(198,72,127,.18)' },
                        { offset: 1, color: 'rgba(198,72,127,0)' }
                    ])
                }
            }]
        };
        
        chart.setOption(option);
    }
    
    initializeGauge() {
        // Build a rounded nonagon (9-gon) path
        function buildRoundedNonagonPath(sides = 9, R = 95, corner = 26, cx = 128, cy = 128) {
            const rot = -Math.PI / 2; // start at top
            const verts = Array.from({ length: sides }, (_, i) => {
                const a = rot + i * 2 * Math.PI / sides;
                return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
            });
            const interior = (sides - 2) * Math.PI / sides;
            const offset = corner / Math.tan(interior / 2);
            const path = [];
            
            for (let i = 0; i < sides; i++) {
                const vPrev = verts[(i - 1 + sides) % sides];
                const v = verts[i];
                const vNext = verts[(i + 1) % sides];
                const dirPrev = [v[0] - vPrev[0], v[1] - vPrev[1]];
                const lenPrev = Math.hypot(...dirPrev);
                const nPrev = [dirPrev[0] / lenPrev, dirPrev[1] / lenPrev];
                const dirNext = [vNext[0] - v[0], vNext[1] - v[1]];
                const lenNext = Math.hypot(...dirNext);
                const nNext = [dirNext[0] / lenNext, dirNext[1] / lenNext];
                const d = Math.min(offset, lenPrev * 0.49, lenNext * 0.49);
                const p1 = [v[0] - nPrev[0] * d, v[1] - nPrev[1] * d];
                const p2 = [v[0] + nNext[0] * d, v[1] + nNext[1] * d];
                
                if (i === 0) {
                    path.push(`M ${p1[0].toFixed(3)} ${p1[1].toFixed(3)}`);
                } else {
                    path.push(`L ${p1[0].toFixed(3)} ${p1[1].toFixed(3)}`);
                }
                path.push(`A ${corner} ${corner} 0 0 1 ${p2[0].toFixed(3)} ${p2[1].toFixed(3)}`);
            }
            path.push('Z');
            return path.join(' ');
        }
        
        // Wait for DOM to be ready
        setTimeout(() => {
            const d = buildRoundedNonagonPath(9, 95, 28, 128, 128);
            const fill = document.getElementById('gaugeFill');
            const outline = document.getElementById('gaugeOutline');
            if (fill && outline) {
                fill.setAttribute('d', d);
                outline.setAttribute('d', d);
                console.log('Gauge initialized successfully');
            } else {
                console.error('Gauge elements not found:', { fill: !!fill, outline: !!outline });
            }
            
            // Initialize with default score
            this.updateGauge(85);
        }, 50);
    }
    
    updateGauge(score) {
        const scoreElement = document.getElementById('score');
        if (scoreElement) {
            scoreElement.textContent = Math.round(score);
            
            // Update color based on score
            if (score >= 80) {
                scoreElement.className = 'text-7xl font-extrabold text-mint drop-shadow';
            } else if (score >= 60) {
                scoreElement.className = 'text-7xl font-extrabold text-amber drop-shadow';
            } else {
                scoreElement.className = 'text-7xl font-extrabold text-danger drop-shadow';
            }
        }
    }
    
    calculateDepartmentScores(data) {
        // Calculate Throughput Score (based on download and upload speeds)
        const downloadScore = Math.min(100, (data.download_speed / 500) * 100);
        const uploadScore = Math.min(100, (data.upload_speed / 100) * 100);
        const throughputScore = Math.round((downloadScore + uploadScore) / 2);
        
        // Calculate Responsiveness Score (based on RTT and jitter)
        const rttScore = Math.max(0, 100 - (data.internet_rtt - 20) / 2);
        const jitterScore = Math.max(0, 100 - data.jitter * 5);
        const responsivenessScore = Math.round((rttScore + jitterScore) / 2);
        
        // Calculate Reliability Score (based on packet loss)
        const reliabilityScore = Math.round(Math.max(0, 100 - data.packet_loss * 20));
        
        // Calculate Speed Score (combination of throughput and latency)
        const speedScore = Math.round((throughputScore * 0.7 + rttScore * 0.3));
        
        // Calculate Intelligence Score (based on overall network health)
        const intelligenceScore = Math.round(
            (throughputScore * 0.25 + responsivenessScore * 0.35 + 
             reliabilityScore * 0.3 + speedScore * 0.1)
        );
        
        return {
            throughput: throughputScore,
            responsiveness: responsivenessScore,
            reliability: reliabilityScore,
            speed: speedScore,
            intelligence: intelligenceScore
        };
    }
    
    updateScoreBadges(scores) {
        const scoreElements = {
            'throughputScore': scores.throughput,
            'responsivenessScore': scores.responsiveness,
            'reliabilityScore': scores.reliability,
            'speedScore': scores.speed,
            'intelligenceScore': scores.intelligence
        };
        
        Object.entries(scoreElements).forEach(([id, score]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = score;
                // Update color based on score
                if (score >= 80) {
                    element.className = 'text-xl font-bold text-mint';
                } else if (score >= 60) {
                    element.className = 'text-xl font-bold text-amber';
                } else {
                    element.className = 'text-xl font-bold text-danger';
                }
            }
        });
    }
    
    updateRealTimeData(data) {
        // Calculate and update department scores
        const scores = this.calculateDepartmentScores(data);
        this.updateScoreBadges(scores);
        
        // Update overall gauge with average score
        const overallScore = Math.round(
            (scores.throughput + scores.responsiveness + scores.reliability + scores.speed) / 4
        );
        this.updateGauge(overallScore);
        
        // Update status text
        const statusHead = document.getElementById('statusHead');
        const statusSub = document.getElementById('statusSub');
        
        if (overallScore >= 80) {
            if (statusHead) statusHead.textContent = 'Excellent Performance';
            if (statusSub) statusSub.textContent = 'Your connection is performing exceptionally well with fast speeds and low latency.';
        } else if (overallScore >= 60) {
            if (statusHead) statusHead.textContent = 'Good Performance';
            if (statusSub) statusSub.textContent = 'Your connection is working well with minor fluctuations in performance.';
        } else if (overallScore >= 40) {
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
        
        // Update SVG lag displays
        const svgRouterLag = document.getElementById('svgRouterLag');
        const svgInternetLag = document.getElementById('svgInternetLag');
        if (svgRouterLag) svgRouterLag.textContent = `${Math.round(data.router_rtt)} ms`;
        if (svgInternetLag) svgInternetLag.textContent = `${Math.round(data.internet_rtt)} ms`;
        
        // Update responsiveness score
        const respScore = document.getElementById('respScore');
        if (respScore) {
            const responsiveness = Math.max(0, 100 - (data.internet_rtt - 20) * 2);
            respScore.textContent = Math.round(responsiveness);
        }
        
        // Update TTFB, DNS, and trend
        const ttfb = document.getElementById('ttfb');
        const dns = document.getElementById('dns');
        if (ttfb) ttfb.textContent = `${Math.round(data.router_rtt * 5)} ms`;
        if (dns) dns.textContent = `${Math.round(data.router_rtt * 3)} ms`;
        
        // Update reliability bar
        const relBar = document.getElementById('relBar');
        if (relBar) {
            const reliability = Math.max(0, 100 - data.packet_loss * 20);
            relBar.style.width = `${reliability}%`;
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
            'iLoss': `${(data.packet_loss * 0.8).toFixed(1)} %`,
            
            // Speed metrics
            'downNow': `${Math.round(data.download_speed)}`,
            'downAvg': `${Math.round(data.download_speed * 0.95)}`,
            'downBest': `${Math.round(data.download_speed * 1.1)}`,
            'downWorst': `${Math.round(data.download_speed * 0.8)}`,
            'upNow': `${Math.round(data.upload_speed)}`,
            'upAvg': `${Math.round(data.upload_speed * 0.95)}`,
            'upBest': `${Math.round(data.upload_speed * 1.1)}`,
            'upWorst': `${Math.round(data.upload_speed * 0.8)}`,
            
            // Network intelligence
            'dnsLag': `${Math.round(data.router_rtt / 2)} ms`,
            'wifiDbm': `-${45 + Math.round(data.jitter / 2)}`
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (element.tagName === 'SPAN') {
                    element.textContent = value;
                } else {
                    element.textContent = `${value}`;
                }
            }
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
    
    runDemoPing(host) {
        if (!this.charts.ping) return;
        
        const xs = [];
        const ys = [];
        let t = 0;
        const base = 25 + Math.random() * 40;
        
        const timer = setInterval(() => {
            t++;
            const jitter = (Math.random() - 0.5) * 10;
            const val = Math.max(1, Math.round(base + jitter));
            xs.push(t);
            ys.push(val);
            
            this.charts.ping.setOption({
                xAxis: { data: xs },
                series: [{ data: ys }]
            });
            
            if (t >= 20) clearInterval(timer);
        }, 180);
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
    // Wait a bit to ensure all DOM elements are rendered
    setTimeout(() => {
        window.dashboard = new PingWiseDashboard();
    }, 200);
});

// Backup initialization for cases where DOMContentLoaded already fired
if (document.readyState === 'loading') {
    // Loading hasn't finished yet
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (!window.dashboard) {
                window.dashboard = new PingWiseDashboard();
            }
        }, 200);
    });
} else {
    // DOMContentLoaded has already fired
    setTimeout(() => {
        if (!window.dashboard) {
            window.dashboard = new PingWiseDashboard();
        }
    }, 300);
}