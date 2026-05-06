//Main ROI: Adana, Icel, Hatay (FAO/GAUL)
var roi = ee.FeatureCollection('FAO/GAUL/2015/level1')
  .filter(ee.Filter.inList('ADM1_NAME',['Adana','Icel','Hatay']))
  .geometry();
//Kozan ROI: for fire risk model
var kozan_roi= ee.FeatureCollection('FAO/GAUL/2015/level2')
  .filter(ee.Filter.eq('ADM2_NAME','Kozan'))
  .geometry();

//Load and filter by region, data range and thermal bands of Landsat 8 and 9
var landsat = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))
  .filterBounds(roi)
  .filterDate('2020-01-01','2025-01-01')
  .filter(ee.Filter.lt('CLOUD_COVER',20));

print('Total number of Landsat images', landsat.size());

//Quality mask: Masking low quality pixels using QC_Day band (bits 0-1)
function processLandsat(image){
  var qa = image.select('QA_PIXEL');
  var cloud_mask = qa.bitwiseAnd(1<<3).eq(0)
    .and(qa.bitwiseAnd(1<<4).eq(0));
    
  //Convert digital numbers to Celsius
  var lst = image.select('ST_B10')
    .multiply(0.00341802)
    .add(149.0)
    .subtract(273.15)
    .rename('LST_C')
    .updateMask(cloud_mask);
    
  return lst.copyProperties(image,['system:time_start']);
}

//Sampling for control
var landsat_lst = landsat.map(processLandsat);

var sample = landsat_lst
  .filterDate('2023-07-01','2023-08-31')
  .mean()
  .clip(roi);
  
var vis = {min: 20, max: 55, palette: ['blue', 'cyan', 'yellow', 'orange', 'red']};

Map.setCenter(36.2, 36.8, 9);
Map.addLayer(roi, {color: 'white'},'Main ROI');
Map.addLayer(kozan_roi, {color: 'yellow'}, 'Kozan Subplace');
Map.addLayer(sample, vis, 'Landsat LST(Summer 2023)');

var stats = sample.reduceRegion({
  reducer: ee.Reducer.mean()
    .combine(ee.Reducer.min(), null, true)
    .combine(ee.Reducer.max(), null, true),
  geometry: roi,
  scale: 30,
  maxPixels: 1e9
});

print('Landsat LST (Summer 2023):', stats);

//Compositing for clean images 

var summer = landsat_lst
  .filter(ee.Filter.calendarRange(6, 8, 'month'))
  .mean().clip(roi).rename('LST_Summer');
  
var winter = landsat_lst
  .filter(ee.Filter.calendarRange(12, 2, 'month'))
  .mean().clip(roi).rename('LST_Winter');
  
Map.addLayer(summer, {min:25,max:55, palette:['yellow','orange','red']},'Landsat Summer LST',false);

Map.addLayer(winter, {min:0, max:20, palette:['blue', 'cyan', 'white']},'Landsat Winter LST',false);

//Exporting of images to Drive ("GEE_LST_Exports" folder)

var export_region = ee.Geometry.Rectangle([35.8, 36.0, 36.6, 37.6]);

Export.image.toDrive({
  image: summer,
  description: 'Landsat_LST_Summer_2020_2025',
  folder:'GEE_LST_Exports',
  region:export_region,
  scale:30,
  crs:'EPSG:4326',
  maxPixels:1e9
});

Export.image.toDrive({
  image: winter,
  description: 'Landsat_LST_Winter_2020_2025',
  folder:'GEE_LST_Exports',
  region: export_region,
  scale:30,
  crs:'EPSG:4326',
  maxPixels:1e9
});

Export.image.toDrive({
  image:summer.clip(kozan_roi),
  description: 'Landsat_LST_Kozan_Summer_2020_2025',
  folder: 'GEE_LST_Exports',
  region: export_region,
  scale:30,
  crs:'EPSG:4326',
  maxPixels:1e9
});


// Controlling max temperature
var hot_pixels = summer.gt(55);  // >55°C

Map.addLayer(
  summer.updateMask(hot_pixels),
  {min: 55, max: 65, palette: ['orange', 'red', 'darkred']},
  '55°C+ Sıcak Noktalar'
);

var landcover = ee.ImageCollection('MODIS/061/MCD12Q1')
  .filterDate('2023-01-01', '2023-12-31')
  .first()
  .select('LC_Type1')
  .clip(roi);

Map.addLayer(landcover, 
  {min: 1, max: 17, palette: [
    '05450a', '086a10', '54a708', '78d203', '009900',
    'c6b044', 'dcd159', 'dade48', 'fbff13', 'b6ff05',
    '27ff87', 'c24f44', 'a5a5a5', 'ff6d4c', '69fff8',
    'f9ffa4', '1c0dff'
  ]},
  'Arazi Örtüsü', false
);

var zones = ee.FeatureCollection('FAO/GAUL/2015/level1')
  .filter(ee.Filter.inList('ADM1_NAME', ['Adana', 'Icel', 'Hatay']));

var zone_stats = summer.reduceRegions({
  collection: zones,
  reducer: ee.Reducer.mean()
    .combine(ee.Reducer.max(), null, true),
  scale: 30
});

print('Provincial LST statistics:', zone_stats);

// Histogram 
var histogram = ui.Chart.image.histogram({
  image: summer,
  region: roi,
  scale: 500,
  maxPixels: 1e9
}).setOptions({
  title: 'LST Temperature Distribution (Summer)',
  hAxis: {title: 'Temperature (°C)'},
  vAxis: {title: 'Pixel Count'},
  colors: ['red']
});

print(histogram);

