// KOZAN ROI
var kozan_roi = ee.FeatureCollection('FAO/GAUL/2015/level2')
  .filter(ee.Filter.eq('ADM2_NAME', 'Kozan'))
  .geometry();

// LANDSAT — LST + NDVI + NDWI + NBR + EVI

var landsat = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))
  .filterBounds(kozan_roi)
  .filterDate('2020-01-01', '2025-01-01')
  .filter(ee.Filter.lt('CLOUD_COVER', 20));

function processLandsat(image) {
  var qa = image.select('QA_PIXEL');
  var cloud_mask = qa.bitwiseAnd(1 << 3).eq(0)
    .and(qa.bitwiseAnd(1 << 4).eq(0));

  var lst  = image.select('ST_B10')
    .multiply(0.00341802).add(149.0).subtract(273.15).rename('LST_C');

  var blue  = image.select('SR_B2').multiply(0.0000275).add(-0.2);
  var green = image.select('SR_B3').multiply(0.0000275).add(-0.2);
  var red   = image.select('SR_B4').multiply(0.0000275).add(-0.2);
  var nir   = image.select('SR_B5').multiply(0.0000275).add(-0.2);
  var swir1 = image.select('SR_B6').multiply(0.0000275).add(-0.2);
  var swir2 = image.select('SR_B7').multiply(0.0000275).add(-0.2);

  // NDVI: vegetation
  var ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');

  // NDWI: humidity index
  var ndwi = green.subtract(nir).divide(green.add(nir)).rename('NDWI');

  // NBR: burnt area index
  var nbr = nir.subtract(swir2).divide(nir.add(swir2)).rename('NBR');

  // EVI: advanced vegetation index
  var evi = nir.subtract(red)
    .divide(nir.add(red.multiply(6)).subtract(blue.multiply(7.5)).add(1))
    .multiply(2.5).rename('EVI');

  // SAVI: soil effect reduced plant index
  var savi = nir.subtract(red)
    .divide(nir.add(red).add(0.5))
    .multiply(1.5).rename('SAVI');

  // BSI: bare soil index
  var bsi = swir1.add(red).subtract(nir.add(blue))
    .divide(swir1.add(red).add(nir).add(blue))
    .rename('BSI');

  return lst.addBands(ndvi).addBands(ndwi).addBands(nbr)
    .addBands(evi).addBands(savi).addBands(bsi)
    .updateMask(cloud_mask)
    .copyProperties(image, ['system:time_start']);
}

var landsat_processed = landsat.map(processLandsat);
var landsat_mean = landsat_processed.mean().clip(kozan_roi);

// DEM - Height, Slope, Aspect
var dem       = ee.Image('USGS/SRTMGL1_003').clip(kozan_roi);
var slope     = ee.Terrain.slope(dem).rename('slope');
var aspect    = ee.Terrain.aspect(dem).rename('aspect');
var elevation = dem.rename('elevation');

// MODIS LST
var modis_lst = ee.ImageCollection('MODIS/061/MOD11A1')
  .filterBounds(kozan_roi)
  .filterDate('2020-01-01', '2025-01-01')
  .select('LST_Day_1km')
  .map(function(img) {
    return img.multiply(0.02).subtract(273.15)
      .rename('MODIS_LST')
      .copyProperties(img, ['system:time_start']);
  });

var modis_mean = modis_lst.mean().clip(kozan_roi);

// Combine all features
var features = landsat_mean
  .addBands(elevation)
  .addBands(slope)
  .addBands(aspect)
  .addBands(modis_mean);

print('All features:', features.bandNames());

// FIRMS fire points
var firms = ee.ImageCollection('FIRMS')
  .filterBounds(kozan_roi)
  .filterDate('2020-01-01', '2025-01-01')
  .select('T21');

var fire_points = firms.map(function(image) {
  var fire_mask = image.gt(300).selfMask();
  var vectors = fire_mask.reduceToVectors({
    geometry: kozan_roi,
    scale: 1000,
    maxPixels: 1e9,
    bestEffort: true,
    geometryType: 'centroid'
  });
  return vectors.map(function(f) {
    return f.set('date', image.date().format('YYYY-MM-dd'))
             .set('month', image.date().get('month'))
             .set('fire_label', 1);
  });
}).flatten().limit(500);

print('Fire points count:', fire_points.size());

// Add features to points
var fire_with_features = features.reduceRegions({
  collection: fire_points,
  reducer: ee.Reducer.mean(),
  scale: 1000
}).map(function(f) {
  return ee.Feature(null, {
    'LST_C':     f.get('LST_C'),
    'NDVI':      f.get('NDVI'),
    'NDWI':      f.get('NDWI'),
    'NBR':       f.get('NBR'),
    'EVI':       f.get('EVI'),
    'SAVI':      f.get('SAVI'),
    'BSI':       f.get('BSI'),
    'elevation': f.get('elevation'),
    'slope':     f.get('slope'),
    'aspect':    f.get('aspect'),
    'MODIS_LST': f.get('MODIS_LST'),
    'month':     f.get('month'),
    'fire_label': 1
  });
});

var non_fire_points = features.sample({
  region: kozan_roi,
  scale: 1000,
  numPixels: 500,
  seed: 42,
  geometries: false
}).map(function(f) {
  return ee.Feature(null, {
    'LST_C':     f.get('LST_C'),
    'NDVI':      f.get('NDVI'),
    'NDWI':      f.get('NDWI'),
    'NBR':       f.get('NBR'),
    'EVI':       f.get('EVI'),
    'SAVI':      f.get('SAVI'),
    'BSI':       f.get('BSI'),
    'elevation': f.get('elevation'),
    'slope':     f.get('slope'),
    'aspect':    f.get('aspect'),
    'MODIS_LST': f.get('MODIS_LST'),
    'month':     6,
    'fire_label': 0
  });
});

// Combine and export to drive
var dataset = fire_with_features.merge(non_fire_points);

print('Final dataset size:', dataset.size());
print('Sample fire:', fire_with_features.first());

Export.table.toDrive({
  collection: dataset,
  description: 'Kozan_Fire_Risk_Dataset',
  folder: 'GEE_LST_Exports',
  fileFormat: 'CSV'
});
