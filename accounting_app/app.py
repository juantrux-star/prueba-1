import os
import json
import sys
import threading
import webbrowser
from flask import Flask, render_template, request, jsonify
import tkinter as tk
from tkinter import filedialog

# Initialize Flask
if getattr(sys, 'frozen', False):
    template_folder = os.path.join(sys._MEIPASS, 'templates')
    static_folder = os.path.join(sys._MEIPASS, 'static')
    app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
else:
    app = Flask(__name__)

# State
current_file_path = None

def open_file_dialog(save=False, default_name="contabilidad.json"):
    """Open a native file dialog on the main thread (or separate tk thread)."""
    # Create a hidden root window
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)  # Bring to front
    
    file_path = None
    try:
        if save:
            file_path = filedialog.asksaveasfilename(
                title="Guardar Contabilidad",
                defaultextension=".json",
                initialfile=default_name,
                filetypes=[("Archivos JSON", "*.json"), ("Todos los archivos", "*.*")]
            )
        else:
            file_path = filedialog.askopenfilename(
                title="Abrir Archivo de Contabilidad",
                filetypes=[("Archivos JSON", "*.json"), ("Todos los archivos", "*.*")]
            )
    finally:
        root.destroy()
        
    return file_path

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/native/status', methods=['GET'])
def get_status():
    global current_file_path
    name = os.path.basename(current_file_path) if current_file_path else None
    return jsonify({'connected': True, 'currentFile': name})

@app.route('/api/native/open', methods=['GET'])
def native_open():
    global current_file_path
    path = open_file_dialog(save=False)
    if path:
        current_file_path = path
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return jsonify({'success': True, 'filename': os.path.basename(path), 'data': data})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})
    return jsonify({'success': False, 'cancelled': True})

@app.route('/api/native/save', methods=['POST'])
def native_save():
    global current_file_path
    payload = request.json
    data = payload.get('data')
    
    # If we don't have a path, treat as "Save As"
    target_path = current_file_path
    
    if not target_path:
        return native_save_as()

    try:
        with open(target_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return jsonify({'success': True, 'filename': os.path.basename(target_path)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/native/save_as', methods=['POST'])
def native_save_as():
    global current_file_path
    payload = request.json
    data = payload.get('data')
    default_name = payload.get('currentFilename', 'contabilidad.json')
    if not default_name.endswith('.json'): default_name += '.json'

    path = open_file_dialog(save=True, default_name=default_name)
    if path:
        current_file_path = path
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return jsonify({'success': True, 'filename': os.path.basename(path)})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})
    return jsonify({'success': False, 'cancelled': True})

def open_browser():
    webbrowser.open_new('http://127.0.0.1:5000/')

if __name__ == '__main__':
    # Open browser automatically
    threading.Timer(1.5, open_browser).start()
    app.run(port=5000, debug=False)
