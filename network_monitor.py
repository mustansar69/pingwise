import threading
import time
import random
import math
from datetime import datetime, timedelta
from collections import deque
import logging

logger = logging.getLogger(__name__)

class NetworkMonitor:
    _instance = None
    
    def __init__(self, socketio):
        self.socketio = socketio
        self.running = False
        self.thread = None
        
        # Data storage (in production, this would be a proper database)
        self.current_data = {
            'score': 85,
            'download_speed': 230,
            'upload_speed': 22,
            'router_rtt': 50,
            'internet_rtt': 62,
            'jitter': 9,
            'packet_loss': 0.5,
            'timestamp': datetime.now()
        }
        
        # Historical data storage (last 24 hours of data points)
        self.history = {
            '1min': deque(maxlen=1440),    # 24 hours of 1-minute data
            '5min': deque(maxlen=288),     # 24 hours of 5-minute data  
            '1hour': deque(maxlen=168),    # 7 days of 1-hour data
            '24hours': deque(maxlen=30)    # 30 days of daily data
        }
        
        # Initialize with some baseline data
        self._initialize_history()
        
        # Set class instance
        NetworkMonitor._instance = self
        
        # Start monitoring
        self.start_monitoring()
    
    @classmethod
    def get_instance(cls):
        return cls._instance
    
    def _initialize_history(self):
        """Initialize historical data with realistic baseline values"""
        now = datetime.now()
        
        # Generate 1-minute data for the last hour
        for i in range(60):
            timestamp = now - timedelta(minutes=i)
            data_point = self._generate_realistic_data_point(timestamp)
            self.history['1min'].appendleft(data_point)
        
        # Generate 5-minute data for the last 4 hours
        for i in range(48):
            timestamp = now - timedelta(minutes=i*5)
            data_point = self._generate_realistic_data_point(timestamp)
            self.history['5min'].appendleft(data_point)
        
        # Generate hourly data for the last day
        for i in range(24):
            timestamp = now - timedelta(hours=i)
            data_point = self._generate_realistic_data_point(timestamp)
            self.history['1hour'].appendleft(data_point)
        
        # Generate daily data for the last week
        for i in range(7):
            timestamp = now - timedelta(days=i)
            data_point = self._generate_realistic_data_point(timestamp)
            self.history['24hours'].appendleft(data_point)
    
    def _generate_realistic_data_point(self, timestamp):
        """Generate realistic network monitoring data"""
        # Base values with some randomness
        base_download = 230 + random.uniform(-30, 50)
        base_upload = 22 + random.uniform(-5, 8)
        
        # RTT varies throughout the day (higher during peak hours)
        hour = timestamp.hour
        peak_factor = 1.0
        if 18 <= hour <= 23 or 7 <= hour <= 9:  # Peak hours
            peak_factor = 1.3
        elif 0 <= hour <= 6:  # Low usage hours
            peak_factor = 0.8
        
        router_rtt = max(1, (45 + random.uniform(-15, 25)) * peak_factor)
        internet_rtt = max(router_rtt + 5, (55 + random.uniform(-20, 30)) * peak_factor)
        
        # Jitter and packet loss
        jitter = max(0.1, 8 + random.uniform(-3, 5))
        packet_loss = max(0, min(5, random.uniform(0, 1.5)))
        
        # Calculate score based on metrics
        score = self._calculate_score(base_download, base_upload, router_rtt, internet_rtt, jitter, packet_loss)
        
        return {
            'timestamp': timestamp,
            'score': round(score),
            'download_speed': round(base_download, 1),
            'upload_speed': round(base_upload, 1),
            'router_rtt': round(router_rtt, 1),
            'internet_rtt': round(internet_rtt, 1),
            'jitter': round(jitter, 1),
            'packet_loss': round(packet_loss, 2)
        }
    
    def _calculate_score(self, download, upload, router_rtt, internet_rtt, jitter, packet_loss):
        """Calculate overall network score"""
        # Scoring algorithm (0-100)
        speed_score = min(100, (download / 300 + upload / 50) * 50)
        latency_score = max(0, 100 - (internet_rtt - 20) * 2)
        jitter_score = max(0, 100 - jitter * 5)
        loss_score = max(0, 100 - packet_loss * 20)
        
        # Weighted average
        total_score = (speed_score * 0.4 + latency_score * 0.3 + jitter_score * 0.2 + loss_score * 0.1)
        return min(100, max(0, total_score))
    
    def start_monitoring(self):
        """Start the monitoring thread"""
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._monitor_loop)
            self.thread.daemon = True
            self.thread.start()
            logger.info("Network monitoring started")
    
    def stop_monitoring(self):
        """Stop the monitoring thread"""
        self.running = False
        if self.thread:
            self.thread.join()
        logger.info("Network monitoring stopped")
    
    def _monitor_loop(self):
        """Main monitoring loop"""
        last_minute_update = time.time()
        last_5min_update = time.time()
        
        while self.running:
            try:
                current_time = time.time()
                now = datetime.now()
                
                # Update current data every 2 seconds
                self.current_data = self._generate_realistic_data_point(now)
                
                # Emit real-time update
                self.socketio.emit('network_update', {
                    'score': self.current_data['score'],
                    'download_speed': self.current_data['download_speed'],
                    'upload_speed': self.current_data['upload_speed'],
                    'router_rtt': self.current_data['router_rtt'],
                    'internet_rtt': self.current_data['internet_rtt'],
                    'jitter': self.current_data['jitter'],
                    'packet_loss': self.current_data['packet_loss'],
                    'timestamp': now.isoformat()
                })
                
                # Add to 1-minute history every minute
                if current_time - last_minute_update >= 60:
                    self.history['1min'].append(dict(self.current_data))
                    last_minute_update = current_time
                
                # Add to 5-minute history every 5 minutes
                if current_time - last_5min_update >= 300:
                    self.history['5min'].append(dict(self.current_data))
                    last_5min_update = current_time
                
                time.sleep(2)  # Update every 2 seconds
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(5)  # Wait before retrying
    
    def get_current_status(self):
        """Get current network status"""
        score = self.current_data['score']
        
        if score >= 80:
            status = "Excellent"
            description = "Your connection is performing exceptionally well."
        elif score >= 60:
            status = "Good"
            description = "Your connection is working well with minor fluctuations."
        elif score >= 40:
            status = "Fair"
            description = "Your connection has some performance issues."
        else:
            status = "Poor"
            description = "Your connection is experiencing significant problems."
        
        return {
            'score': score,
            'status': status,
            'description': description,
            'download_speed': self.current_data['download_speed'],
            'upload_speed': self.current_data['upload_speed'],
            'router_rtt': self.current_data['router_rtt'],
            'internet_rtt': self.current_data['internet_rtt'],
            'jitter': self.current_data['jitter'],
            'packet_loss': self.current_data['packet_loss']
        }
    
    def get_historical_data(self, time_range):
        """Get historical data for specified time range"""
        if time_range not in self.history:
            time_range = '1min'
        
        data = list(self.history[time_range])
        
        # Convert timestamps to ISO format for JSON serialization
        for point in data:
            if isinstance(point['timestamp'], datetime):
                point['timestamp'] = point['timestamp'].isoformat()
        
        return {
            'range': time_range,
            'data': data,
            'count': len(data)
        }
