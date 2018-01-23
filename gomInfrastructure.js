var geometry = /* color: #d63000 */ee.FeatureCollection(
        [ee.Feature(
            ee.Geometry.Point([-93.76054286956787, 29.675142815743413]),
            {
              "system:index": "0"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.74749392271042, 29.683268834038845]),
            {
              "system:index": "1"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.72940510511398, 29.68624450550588]),
            {
              "system:index": "2"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.71664047241211, 29.67830299573774]),
            {
              "system:index": "3"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.71315360069275, 29.697521751830156]),
            {
              "system:index": "4"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.71835708618164, 29.700792890465706]),
            {
              "system:index": "5"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.71438205504091, 29.706850370004254]),
            {
              "system:index": "6"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.67992640065495, 29.700056467179262]),
            {
              "system:index": "7"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.66748094558716, 29.659769947726407]),
            {
              "system:index": "8"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.67325306986459, 29.624988258046866]),
            {
              "system:index": "9"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.56564283370972, 29.64686590127903]),
            {
              "system:index": "10"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.56919407844543, 29.652637689997558]),
            {
              "system:index": "11"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.56705904006958, 29.661056532160018]),
            {
              "system:index": "12"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.59944940137211, 29.691510407401346]),
            {
              "system:index": "13"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.59745383786503, 29.69347694880586]),
            {
              "system:index": "14"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.59821558522526, 29.693933628269736]),
            {
              "system:index": "15"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.5801374912262, 29.697102464079187]),
            {
              "system:index": "16"
            }),
        ee.Feature(
            ee.Geometry.Point([-93.58168244361877, 29.693598205570026]),
            {
              "system:index": "17"
            })]),
    geometry2 = /* color: #98ff00 */ee.Geometry.Polygon(
        [[[-93.77277374267578, 29.682233486372215],
          [-93.77294540405273, 29.672091669209557],
          [-93.76522064208984, 29.663738816418526],
          [-93.69157791137695, 29.619725733112382],
          [-93.66994857788086, 29.61450256539818],
          [-93.56660842895508, 29.635841229845514],
          [-93.55476379394531, 29.641809278079652],
          [-93.55356216430664, 29.652550873491144],
          [-93.57107162475586, 29.70817994780884],
          [-93.57982635498047, 29.71026730284272],
          [-93.59991073608398, 29.707583552686533],
          [-93.67887496948242, 29.714143704210127],
          [-93.71166229248047, 29.72025618687395],
          [-93.7214469909668, 29.719212618622336]]]);

var boem1 = ee.FeatureCollection("users/christian/gulfPlatforms_inPlace_4326")
var boem2 = ee.FeatureCollection("users/christian/BOEM_Platforms_Update")

// add the 2 BOEM feature collections to see overlap
Map.addLayer(boem1, {color:'blue'}, 'boem set 1')
Map.addLayer(boem2, {color:'green'}, 'boem set 2')

// angle correction function
var sarAngleCorrection = function(image) {
  return image.select('V.|H.').subtract(image.select('angle').multiply(Math.PI/180.0).pow(2).cos().log10().multiply(10.0));
};

// S1 collection with filters, angle correction, median filter, and aoi clip applied
var s1GomSubsetMedianCollection = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterDate('2017-01-01', '2017-12-31')  
  .filterBounds(geometry2)
  .filterMetadata('instrumentMode', 'equals', 'IW')
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .map(sarAngleCorrection)
  .median()
  .clip(geometry2)
  
// vh band visualization
var S1_viz = {bands:'VH',min:-29,max:0};
Map.addLayer(s1GomSubsetMedianCollection, S1_viz, 's1GomSubsetMedianCollection')

// workaround trick to make 2 identical bands for the reduce to vector function later
var threshold = -19.5
var candidatePixels = s1GomSubsetMedianCollection.select('VH').gte(threshold)//.addBands(s1GomSubsetMedianCollection.select('VH').gte(threshold))

// visualize pixels meeting previous threshold requirements
var imageVisParam = {"opacity":1,"bands":["VH"],"palette":["ffffff","ff2805"]}
Map.addLayer(candidatePixels, imageVisParam, 'candidate infrastructure pixels', true, 0.35)

// testing out erosion followed by a dilation to get rid of solo pixels
var cleanedCandidatePixels = candidatePixels
             .focal_max({kernel: ee.Kernel.euclidean({radius: 20, units: 'meters'})})
             //.focal_max({kernel: ee.Kernel.euclidean({radius: 1.5})})
             //.focal_min({kernel: ee.Kernel.euclidean({radius: 7, units: 'meters'})})
             //.focal_max({kernel: ee.Kernel.euclidean({radius: 4, units: 'meters'}), iterations: 2})
             //.focal_min({kernel: kernel, iterations: 1})

// add duplicate band for reducer needs
var cleanedPixels = cleanedCandidatePixels.addBands(cleanedCandidatePixels.select('VH').eq(1))
Map.addLayer(cleanedPixels, {}, 'cleaned candidate infrastructure pixels', true, 0.35)

// vectorize to centriods
var candidateCentroids = cleanedPixels.reduceToVectors(
  {reducer:ee.Reducer.mean(),
  geometry:geometry2,
  scale:10,
  geometryType:'centroid',
  eightConnected:false,
  bestEffort:false,
  maxPixels:1e15});

// visualize and count number of script identified structures
Map.addLayer(candidateCentroids, {color:'red'}, 'infrastructure centroids')
Map.centerObject(s1GomSubsetMedianCollection, 12)
print('script identified structures', candidateCentroids.size())

// calculate and compare BOEM id'd structures w/in aoi for comparison to script id'd structures
var boem1Total = boem1.filterBounds(geometry2).size()
var boem2Total = boem2.filterBounds(geometry2).size()
var boemSubsetTotal = boem1Total.add(boem2Total)
print('BOEM subset total infrastructure objects', boemSubsetTotal)

var manualObjectCount = geometry.size()
print('manually observed infrastructure via high-res imagery', manualObjectCount)