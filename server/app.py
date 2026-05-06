from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import joblib
import numpy as np
import os

app = Flask(__name__)
CORS(app)  # for mobile access

# Upload model and scaler
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model  = joblib.load(os.path.join(BASE_DIR, 'fire_risk_rf_final.pkl'))
scaler = joblib.load(os.path.join(BASE_DIR, 'scaler_final.pkl'))

FEATURE_NAMES = [
    'LST_C', 'MODIS_LST', 'NDVI', 'NDWI', 'NBR',
    'EVI', 'SAVI', 'BSI', 'elevation', 'slope', 'aspect',
    'LST_NDVI_ratio', 'fire_weather_index', 'dryness', 'LST_diff'
]

# Main Page - Mobile Interface
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Fire Risk Monitor</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: #1a1a2e;
      color: #eee;
      min-height: 100vh;
    }
    #header {
      background: rgba(0,0,0,0.7);
      padding: 16px 20px;
      border-bottom: 1px solid #333;
    }
    #header h1 { color: #ff6b35; font-size: 18px; }
    #header p  { color: #aaa; font-size: 12px; margin-top: 4px; }

    .section {
      padding: 16px 20px;
      border-bottom: 1px solid #222;
    }
    .section h2 {
      font-size: 14px;
      color: #ff6b35;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* ── LST Map Selector ── */
    .map-btns {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .map-btn {
      padding: 6px 14px;
      border: 1px solid #555;
      border-radius: 20px;
      background: transparent;
      color: #ccc;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .map-btn.active {
      background: #ff6b35;
      border-color: #ff6b35;
      color: #fff;
    }
    #map-img {
      width: 100%;
      border-radius: 8px;
      border: 1px solid #333;
    }
    #map-caption {
      font-size: 11px;
      color: #aaa;
      margin-top: 6px;
      text-align: center;
    }

    /* ── Prediction Form ── */
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 14px;
    }
    .form-group label {
      display: block;
      font-size: 11px;
      color: #aaa;
      margin-bottom: 4px;
    }
    .form-group input {
      width: 100%;
      padding: 8px 10px;
      background: #0f0f1a;
      border: 1px solid #444;
      border-radius: 6px;
      color: #eee;
      font-size: 13px;
    }
    .form-group input:focus {
      outline: none;
      border-color: #ff6b35;
    }
    #predict-btn {
      width: 100%;
      padding: 12px;
      background: #ff6b35;
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    #predict-btn:hover { background: #e55a25; }

    /* ── Result ── */
    #result {
      display: none;
      margin-top: 14px;
      padding: 14px;
      border-radius: 8px;
      text-align: center;
    }
    #result.high {
      background: rgba(215, 48, 39, 0.2);
      border: 1px solid #d73027;
    }
    #result.low {
      background: rgba(26, 152, 80, 0.2);
      border: 1px solid #1a9850;
    }
    #result-icon  { font-size: 36px; margin-bottom: 6px; }
    #result-label { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    #result-prob  { font-size: 13px; color: #aaa; }

    /* ── Footer ── */
    #footer {
      padding: 16px 20px;
      font-size: 11px;
      color: #555;
      text-align: center;
    }
  </style>
</head>
<body>

<div id="header">
  <h1>🔥 Fire Risk Monitor</h1>
  <p>Eastern Mediterranean — Kozan Sub-region · LST-based Risk Assessment</p>
</div>

<!-- LST Map Section -->
<div class="section">
  <h2>🗺️ LST Thermal Maps</h2>
  <div class="map-btns">
    <button class="map-btn active" onclick="showMap('lst_summer','Summer Mean LST (2020-2025)')">☀️ Summer</button>
    <button class="map-btn" onclick="showMap('lst_winter','Winter Mean LST (2020-2025)')">❄️ Winter</button>
    <button class="map-btn" onclick="showMap('lst_anomaly','LST Anomaly 2023')">📊 Anomaly</button>
    <button class="map-btn" onclick="showMap('lst_kozan','Kozan Summer LST')">🔥 Kozan</button>
  </div>
  <img id="map-img" src="/static/lst_summer.png" alt="LST Map"/>
  <p id="map-caption">Summer Mean LST (2020-2025)</p>
</div>

<!-- Fire Risk Prediction Form -->
<div class="section">
  <h2>⚡ Fire Risk Prediction</h2>
  <div class="form-grid">
    <div class="form-group">
      <label>LST_C (°C)</label>
      <input type="number" id="LST_C" placeholder="e.g. 35.5" step="0.1"/>
    </div>
    <div class="form-group">
      <label>MODIS_LST (°C)</label>
      <input type="number" id="MODIS_LST" placeholder="e.g. 33.0" step="0.1"/>
    </div>
    <div class="form-group">
      <label>NDVI</label>
      <input type="number" id="NDVI" placeholder="e.g. 0.45" step="0.01"/>
    </div>
    <div class="form-group">
      <label>NDWI</label>
      <input type="number" id="NDWI" placeholder="e.g. -0.48" step="0.01"/>
    </div>
    <div class="form-group">
      <label>NBR</label>
      <input type="number" id="NBR" placeholder="e.g. 0.20" step="0.01"/>
    </div>
    <div class="form-group">
      <label>EVI</label>
      <input type="number" id="EVI" placeholder="e.g. 0.30" step="0.01"/>
    </div>
    <div class="form-group">
      <label>SAVI</label>
      <input type="number" id="SAVI" placeholder="e.g. 0.35" step="0.01"/>
    </div>
    <div class="form-group">
      <label>BSI</label>
      <input type="number" id="BSI" placeholder="e.g. -0.10" step="0.01"/>
    </div>
    <div class="form-group">
      <label>Elevation (m)</label>
      <input type="number" id="elevation" placeholder="e.g. 400"/>
    </div>
    <div class="form-group">
      <label>Slope (°)</label>
      <input type="number" id="slope" placeholder="e.g. 5.0" step="0.1"/>
    </div>
    <div class="form-group">
      <label>Aspect (°)</label>
      <input type="number" id="aspect" placeholder="e.g. 180" step="1"/>
    </div>
    <div class="form-group">
      <label>Month (1-12)</label>
      <input type="number" id="month" placeholder="e.g. 7" min="1" max="12"/>
    </div>
  </div>
  <button id="predict-btn" onclick="predict()">⚡ Predict Fire Risk</button>

  <div id="result">
    <div id="result-icon"></div>
    <div id="result-label"></div>
    <div id="result-prob"></div>
  </div>
</div>

<div id="footer">
  Satellite Thermal Digital Twin · MODIS/Landsat LST · Random Forest Model
</div>

<script>
  // Change map
  function showMap(name, caption) {
    document.getElementById('map-img').src = `/static/${name}.png`;
    document.getElementById('map-caption').textContent = caption;
    document.querySelectorAll('.map-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
  }

  // Prediciton
  async function predict() {
    const ids = ['LST_C','MODIS_LST','NDVI','NDWI','NBR',
                 'EVI','SAVI','BSI','elevation','slope','aspect','month'];

    // Read values
    const values = {};
    for (const id of ids) {
      const val = parseFloat(document.getElementById(id).value);
      if (isNaN(val)) {
        alert(`Please fill in: ${id}`);
        return;
      }
      values[id] = val;
    }

    // Derived attributes
    values['LST_NDVI_ratio']      = values['LST_C'] / (values['NDVI'] + 1e-6);
    values['fire_weather_index']  = values['LST_C'] * (1 - values['NDWI']) * values['slope'];
    values['dryness']             = values['BSI'] - values['NDWI'];
    values['LST_diff']            = values['LST_C'] - values['MODIS_LST'];

    try {
      const response = await fetch('/predict', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(values)
      });
      const data = await response.json();

      const result = document.getElementById('result');
      result.style.display = 'block';

      if (data.fire_risk === 1) {
        result.className = 'high';
        document.getElementById('result-icon').textContent  = '🔥';
        document.getElementById('result-label').textContent = 'HIGH FIRE RISK';
        document.getElementById('result-label').style.color = '#d73027';
      } else {
        result.className = 'low';
        document.getElementById('result-icon').textContent  = '✅';
        document.getElementById('result-label').textContent = 'LOW FIRE RISK';
        document.getElementById('result-label').style.color = '#1a9850';
      }
      document.getElementById('result-prob').textContent =
        `Fire probability: ${(data.fire_probability * 100).toFixed(1)}%`;

    } catch (err) {
      alert('Server error: ' + err.message);
    }
  }
</script>

</body>
</html>
'''

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

# Prediction API endpoint
@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()

        # Get attributes in the correct order.
        features = np.array([[data[f] for f in FEATURE_NAMES]])

        # Scalation
        features_scaled = scaler.transform(features)

        # Prediction
        prediction    = model.predict(features_scaled)[0]
        probability   = model.predict_proba(features_scaled)[0][1]

        return jsonify({
            'fire_risk':        int(prediction),
            'fire_probability': float(probability),
            'status':           'success'
        })

    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 400

# Health Control
@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'model': 'Random Forest'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)