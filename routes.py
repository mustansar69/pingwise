from flask import render_template, jsonify, request
from app import app, socketio
from flask_socketio import emit
import logging

logger = logging.getLogger(__name__)

@app.route('/')
def index():
    """Main dashboard page"""
    return render_template('index.html')

@app.route('/api/network/status')
def get_network_status():
    """Get current network status"""
    try:
        # This would be called by the network monitor
        from network_monitor import NetworkMonitor
        monitor = NetworkMonitor.get_instance()
        if monitor:
            return jsonify(monitor.get_current_status())
        else:
            return jsonify({
                'score': 0,
                'status': 'Disconnected',
                'description': 'Network monitor not initialized'
            })
    except Exception as e:
        logger.error(f"Error getting network status: {e}")
        return jsonify({'error': 'Failed to get network status'}), 500

@app.route('/api/network/history')
def get_network_history():
    """Get historical network data"""
    try:
        time_range = request.args.get('range', '1min')
        from network_monitor import NetworkMonitor
        monitor = NetworkMonitor.get_instance()
        if monitor:
            return jsonify(monitor.get_historical_data(time_range))
        else:
            return jsonify({'error': 'Network monitor not available'}), 503
    except Exception as e:
        logger.error(f"Error getting network history: {e}")
        return jsonify({'error': 'Failed to get network history'}), 500

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    logger.info('Client connected')
    emit('status', {'message': 'Connected to Ping Wise'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    logger.info('Client disconnected')

@socketio.on('subscribe_updates')
def handle_subscribe():
    """Handle subscription to real-time updates"""
    logger.info('Client subscribed to updates')
    emit('subscribed', {'message': 'Subscribed to real-time updates'})

@socketio.on('change_time_range')
def handle_time_range_change(data):
    """Handle time range change"""
    time_range = data.get('range', '1min')
    logger.info(f'Time range changed to: {time_range}')
    # Emit updated data for the new time range
    from network_monitor import NetworkMonitor
    monitor = NetworkMonitor.get_instance()
    if monitor:
        historical_data = monitor.get_historical_data(time_range)
        emit('historical_data', historical_data)

@socketio.on('change_server')
def handle_server_change(data):
    """Handle server selection change"""
    server = data.get('server', 'Auto')
    logger.info(f'Server changed to: {server}')
    # In a real implementation, this would change the monitoring target
    emit('server_changed', {'server': server, 'message': f'Switched to {server} server'})
