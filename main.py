import eventlet
# Monkey patch must be first, before any other imports
eventlet.monkey_patch()

from app import app, socketio

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, use_reloader=False, log_output=True)
