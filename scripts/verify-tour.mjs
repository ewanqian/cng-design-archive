#!/usr/bin/env node
// CNG tour source QA. No network, no third-party dependencies.
// Run from repository root: node scripts/verify-tour.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(root, 'tour.json'), 'utf8'));
const errors = [], warnings = [], missingOriginalFrames = [];
const ids = new Set(), viewIds = new Set();
const isURL = s => /^(?:https?:)?\/\//.test(s);
function checkAsset(value, label, runtime = true) {
  if (!value || typeof value !== 'string') { errors.push(label + ': missing path'); return; }
  if (isURL(value)) return;
  const clean = value.split('?')[0].replace(/^\.\/+/,'');
  if (path.isAbsolute(clean) || clean.startsWith('../')) { errors.push(label + ': outside repository ' + clean); return; }
  if (!fs.existsSync(path.join(root, clean))) (runtime ? errors : missingOriginalFrames).push(label + ': ' + clean);
}
for (const station of data.stations || []) {
  if (!station.id || ids.has(station.id)) errors.push('duplicate or missing station ID: ' + station.id);
  ids.add(station.id);
  const views = station.views || [];
  if (!views.length) warnings.push('no public panorama views: ' + station.id);
  if (station.thumbnail) checkAsset(station.thumbnail, 'station ' + station.id + ' thumbnail');
  for (const view of views) {
    const label = station.id + '/' + view.id;
    if (!view.id || viewIds.has(view.id)) errors.push('duplicate or missing view ID: ' + label);
    viewIds.add(view.id);
    for (const key of ['image','preview','thumbnail']) checkAsset(view[key],label+'/'+key);
    if (view.sourceFrame) checkAsset(view.sourceFrame,label+'/sourceFrame',false);
    for (const key of ['yaw','pitch']) if (view[key] !== undefined && !Number.isFinite(view[key])) errors.push(label+'/'+key+' must be finite');
  }
}
for (const link of data.connections || []) {
  if (!ids.has(link.from) || !ids.has(link.to)) errors.push('connection refers to missing station: '+link.from+' -> '+link.to);
}
if (data.modelStatus?.mesh?.url) checkAsset(data.modelStatus.mesh.url,'modelStatus.mesh.url');
if (data.modelStatus?.mesh?.acceptedWholeBuilding === false) warnings.push('3D mesh is a partial sample; do not label as entire building');
if (data.modelStatus?.gaussian === 'pending') warnings.push('Gaussian representation still pending');
const report = {
  repo: path.basename(root),
  stations: ids.size,
  views: viewIds.size,
  runtimeErrors: errors.length,
  missingOriginalFrameReferences: missingOriginalFrames.length,
  warnings: warnings.length,
  errors, warnings,
  provenanceSamples: missingOriginalFrames.slice(0,5)
};
console.log(JSON.stringify(report,null,2));
if (errors.length) process.exitCode = 1;
