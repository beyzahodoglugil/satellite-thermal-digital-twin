# Satellite Thermal Digital Twin
B7-Satellite-Based 3D Thermal Digital Twin with Mobile Interface
GEE/MODIS/Landsat LST-based Eastern Mediterranean Thermal Digital Twin  
with Fire Risk Assessment and Mobile Interface.

## Project Overview
- **Region:** Adana, Mersin (Icel), Hatay — Eastern Mediterranean, Turkey
- **Data:** MODIS MOD11A1 (1km), Landsat Collection 2 (30m), 2020–2025
- **Model:** Random Forest (F1=0.793, ROC-AUC=0.909) + MLP (Recall=0.923)
- **Edge:** NVIDIA Jetson Orin Nano (~22ms inference)
- **Interface:** CesiumJS 3D Digital Twin + Flask Mobile API

## Repository Structure
\```
satellite-thermal-digital-twin/
├── gee_scripts/          # Google Earth Engine scripts
├── notebooks/            # Preprocessing + fire risk model
├── digital_twin/         # CesiumJS 3D web application
└── server/               # Flask API + mobile interface
\```

## Steps Completed
- [x] Step 1-2: GEE setup + MODIS LST pipeline
- [x] Step 3-4: Landsat LST + GeoTIFF export
- [x] Step 5: Python preprocessing (rasterio, xarray)
- [x] Step 6: CesiumJS 3D thermal digital twin
- [x] Step 7: FIRMS fire dataset (Kozan sub-region)
- [x] Step 8: ML fire risk models + Jetson deployment
- [x] Step 9: Flask API + WiFi mobile interface
- [x] Step 10: Documentation

## Key Results
| Model | Recall | F1 | ROC-AUC |
|-------|--------|-----|---------|
| Logistic Regression | 0.885 | 0.697 | 0.936 |
| Random Forest | 0.885 | 0.793 | 0.909 |
| XGBoost | 0.846 | 0.786 | 0.912 |
| MLP | 0.923 | 0.710 | 0.913 |

**Jetson Orin Nano inference:** ~22ms  
**False Negative Rate (MLP):** 7.69%

## How to Run
\```bash
# Flask API
cd server
pip install flask flask-cors joblib scikit-learn numpy
python app.py
# Open: http://localhost:5000
\```

## Data Sources
- MODIS MOD11A1: https://developers.google.com/earth-engine/datasets
- Landsat C2: https://www.usgs.gov/landsat-missions
- FIRMS: https://firms.modaps.eosdis.nasa.gov
- FAO/GAUL: Administrative boundaries
