var roi = ee.FeatureCollection('FAO/GAUL/2015/level1')
  .filter(ee.Filter.inList('ADM1_NAME',['Adana','Mersin','Hatay']))
  .geometry();
var kozan_roi = ee.FeatureCollection('FAO/GAUL/2015/level2')
  .filter(ee.Filter.eq('ADM2_NAME','Kozan'))
  .geometry();

Map.setCenter(36.2, 36.8, 9);
Map.addLayer(roi, {color: 'white'}, 'Main ROI');
Map.addLayer(kozan_roi, {color:'yellow'}, 'Kozan Subplace');

print('Main ROI:', roi.bounds());
print('Kozan ROI:',kozan_roi.bounds());

var modis_raw = ee.ImageCollection("MODIS/061/MOD11A1")
  .filterBounds(roi)
  .filterDate('2021-01-01', '2025-12-31')
  .select('LST_Day_1km', 'QC_Day');

print('Total image number:', modis_raw.size());

function applyQA(image){
  var qa = image.select('QC_Day');
  var good_quality = qa.bitwiseAnd(3).eq(0);
  var lst = image.select('LST_Day_1km')
    .updateMask(good_quality)
    .multiply(0.02)
    .subtract(273.15)
    .rename('LST_C')
  return lst.copyProperties(image, ['system:time_start']);
}

var modis_lst = modis_raw.map(applyQA);

var sample = modis_lst
  .filterDate('2023-07-01', '2023-07-15')
  .mean()
  .clip(roi);
  
var vis = {min: 20, max: 55, palette: ['blue','cyan','yellow','orange','red']};
Map.addLayer(sample, vis, 'LST Sample(July 2023)');

var stats_check = sample.reduceRegion({
  reducer: ee.Reducer.mean()
    .combine(ee.Reducer.min(), null, true)
    .combine(ee.Reducer.max(), null, true),
  geometry: roi,
  scale:1000,
  maxPixels:1e9
});

print('Data correction (July 2023):', stats_check);

var months =ee.List.sequence(1,12);
var years =ee.List.sequence(2020,2024);

var monthly_lst = ee.ImageCollection.fromImages(
  years.map(function(y){
    return months.map(function(m){
      return modis_lst
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.calendarRange(m, m, 'month'))
        .mean()
        .clip(roi)
        .set('year', y)
        .set('month', m)
        .set('system:time_start',
             ee.Date.fromYMD(y, m, 1).millis());
    });
  }).flatten()
);

print('Aylık kompozit sayısı:', monthly_lst.size());

var summer = modis_lst
  .filter(ee.Filter.calendarRange(6, 8, 'month'))
  .mean().clip(roi).rename('LST_Summer');
  
var winter = modis_lst
  .filter(ee.Filter.calendarRange(12, 2, 'month'))
  .mean().clip(roi).rename('LST_Winter');
  
var annual_max= modis_lst
  .filter(ee.Filter.calendarRange(2020, 2024, 'year'))
  .max().clip(roi);
  
var annual_min= modis_lst
  .filter(ee.Filter.calendarRange(2020, 2024, 'year'))
  .min().clip(roi);
  
var longterm_mean=modis_lst.mean().clip(roi);
var anomaly_2023=modis_lst
  .filterDate('2023-01-01', '2024-01-01')
  .mean().clip(roi)
  .subtract(longterm_mean)
  .rename('LST_Anomali');
  
Map.addLayer(summer, {min:25, max:55, palette:['yellow', 'orange', 'red']}, 'LST Summer Mean');
Map.addLayer(winter, {min:0, max:20, palette:['blue','cyan','white']}, 'LST Winter Mean', false);
Map.addLayer(anomaly_2023, {min:-5, max:5, palette:['blue','white','red']},'LST Anomaly 2023',false);

Export.image.toDrive({
  image:summer,
  description: 'LST_Summer_Mean_2020_2025',
  folder:'GEE_LST_Exports',
  region:roi.bounds(),
  scale: 1000,
  crs:'EPSG:4326',
  maxPixels:1e9
});

Export.image.toDrive({
  image:winter,
  description:'LST_Winter_Mean_2020_2025',
  folder:'GEE_LST_Exports',
  region:roi.bounds(),
  scale:1000,
  crs:'EPSG:4326',
  maxPixels:1e9
});

Export.image.toDrive({
  image:summer.clip(kozan_roi),
  description: 'LST_Kozan_Summer_2020_2025',
  folder:'GEE_LST_Exports',
  region:kozan_roi.bounds(1, 'EPSG:4326'),
  scale:1000,
  crs:'EPSG:4326',
  maxPixels:1e9
});

Export.image.toDrive({
  image: anomaly_2023,
  description: 'LST_Anomaly_2023',
  folder: 'GEE_LST_Exports',
  region: roi.bounds(),
  scale: 1000,
  crs: 'EPSG:4326',
  maxPixels: 1e9
});

var ts_chart = ui.Chart.image.series({
  imageCollection: monthly_lst,
  region: roi,
  reducer: ee.Reducer.mean(),
  scale:1000,
  xProperty:'system:time_start'
}).setOptions({
  title: 'Doğu Akdeniz - Aylık LST (2020-2024)',
  hAxis: {title:'Date'},
  vAxis:{title: 'LST (°C)'},
  lineWidth:2,
  colors:['red']
});

print(ts_chart);



















