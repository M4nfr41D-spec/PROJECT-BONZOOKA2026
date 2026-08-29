
/* v1.8 patch — Sprite Generation Machine */
(function(){
  var style = document.createElement('style');
  style.textContent = `
  .machine-wrap{display:grid;grid-template-columns:360px 1fr;gap:16px}
  .machine-card{background:#0b0f18;border:1px solid #223;border-radius:8px;padding:12px}
  .machine-card h4{font-size:12px;color:#ffae66;margin:0 0 8px 0}
  .machine-zone{border:1px dashed #345;border-radius:8px;padding:18px;text-align:center;color:#8aa;cursor:pointer;background:#0a0f18;transition:border-color .15s, background .15s}
  .machine-zone:hover{border-color:#00ccff;background:#0d1420}
  .machine-note{font-size:11px;line-height:1.5;color:#7f8fa8}
  .machine-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;max-height:55vh;overflow:auto}
  .machine-item{background:#0b0f18;border:1px solid #223;border-radius:8px;padding:10px}
  .machine-item.sel{border-color:#00ccff;box-shadow:0 0 0 1px #00ccff inset}
  .machine-item .mh{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:8px}
  .machine-item .mpath{font-size:11px;color:#cfd7ea;line-height:1.35;word-break:break-word}
  .machine-item .mmeta{font-size:10px;color:#789}
  .machine-thumb{height:120px;border:1px solid #202b40;border-radius:6px;background:#05080f;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:8px}
  .machine-thumb img{max-width:100%;max-height:100%;object-fit:contain}
  .machine-fields{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px}
  .machine-fields label{display:flex;flex-direction:column;gap:4px;color:#90a4bd}
  .machine-fields input,.machine-fields select,.machine-card textarea{width:100%;background:#090d15;border:1px solid #233248;color:#dbe7ff;border-radius:6px;padding:7px;font-size:11px}
  .machine-card textarea{min-height:110px;resize:vertical}
  .machine-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
  .machine-stat{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#8da3bf;padding:5px 8px;background:#0b1220;border:1px solid #223;border-radius:999px;margin:0 6px 6px 0}
  .machine-warn{font-size:11px;color:#ffb366;line-height:1.45;white-space:pre-wrap}
  .machine-mini{font-size:10px;color:#7d8aa5;margin-top:8px}
  @media (max-width: 1100px){ .machine-wrap{grid-template-columns:1fr} }
  `;
  document.head.appendChild(style);

  var machine = {
    items: [],
    selected: -1,
    lastImportedAt: null,
    bulk: {
      category: 'effects', entityPrefix: '', state: 'play', size: 256, cols: 4, rows: 4, fps: 12, loop: false,
      sequenceSpec: '', blackBg: true,
      styleNotes: 'state-of-the-art, realistic, production-safe, import-ready, fixed pivot, center-locked, no bleed, no drift'
    }
  };

  function machineNormalizeCategory(cat){ cat=String(cat||'').trim().toLowerCase(); var valid=['player','enemies','elites','bosses','pickups','equipment','effects','bullets','deco']; return valid.indexOf(cat)>=0?cat:(machine.bulk.category||'effects'); }
  function machineSlug(v){ return String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'asset'; }
  function machinePathFor(item){ return 'sprites/' + item.category + '/' + item.entity + '/' + item.state + '.png'; }
  function machinePromptCompressed(subject, blackBg, notes){ var tail=blackBg?'For VFX on black space background: transparent background, no gray matte, no bright fringe, smoke/falloff fades to black or transparency, ember/fire remains readable on black. ':'Transparent background, no matte contamination, no halos, clean readable end frames. '; return 'Subject: ' + subject + '.\nCreate a production-safe sprite sheet for this subject.\nExact uniform grid, center-locked subject in every frame, fixed pivot, no drift, no vertical movement, no scale jumping, no frame-to-frame wobble.\nNo bleed into neighboring tiles, strong safe margins inside each tile, nothing may cross the tile boundary.\nConsistent silhouette progression, clean frame ordering, smooth readable animation arc.\n' + tail + (notes ? (notes.trim() + '. ') : '') + 'High detail, realistic, state-of-the-art, import-ready, sprite-sheet discipline, game-ready.'; }
  function machinePromptDetailed(subject, blackBg, notes){ var bg=blackBg?'Transparent background. For black space-shooter backgrounds: no gray matte, no white halo, no bright fringe, no light edge contamination; outer smoke and soft falloff must fade to transparency or black; embers and hot core must remain readable on black.':'Transparent background, no gray matte, no white halo, no bright fringe, no visible square background.'; return 'Subject: ' + subject + '.\nCreate a state-of-the-art, realistic, production-safe sprite sheet for this subject.\nUse an exact uniform grid with identical tile dimensions and strict tile boundaries.\nKeep the subject perfectly center-locked in every frame with a fixed pivot.\nNo vertical drift, no downward movement, no horizontal drift, no wobble, no frame-to-frame scale shift, no accidental perspective change.\nMaintain strong internal safe margins so the subject never crosses the tile boundary and never bleeds into neighboring frames.\nEnsure clean frame ordering and a smooth readable animation progression from start to finish.\nThe silhouette must remain controlled and coherent across all frames.\nMake the sheet import-ready and atlas-safe.\n' + bg + '\nFinal frames must dissipate cleanly and lose energy clearly.\n' + (notes ? (notes.trim() + '.\n') : '') + 'High detail, realistic material behavior, production quality, game-ready.\n\nNegative prompt: no uneven grid, no broken tile layout, no frame drift, no downward crawl, no subject wobble, no random zoom change, no perspective shift, no neighbor bleed, no overlapping frames, no clipped edges, no cropped silhouette, no duplicate frames, no muddy gray matte, no white halo, no bright fringe, no visible square background, no chaotic misalignment, no inconsistent pivot'; }

  function machineInferPath(rawName){
    var p=String(rawName||'').replace(/\\/g,'/').replace(/^\.\//,'').replace(/^assets\//,'').replace(/^sprites\//,'');
    var noExt=p.replace(/\.png$/i,''); var parts=noExt.split('/').filter(Boolean); var category=machine.bulk.category||'effects'; var entity=''; var state=machine.bulk.state||'play';
    if(parts[0]==='sprites') parts.shift();
    if(parts.length>=3){ category=machineNormalizeCategory(parts[0]); entity=machineSlug(parts[1]); state=machineSlug(parts.slice(2).join('_')); }
    else if(parts.length===2){ category=machineNormalizeCategory(parts[0]); var bits=parts[1].split(/[_\-]+/).filter(Boolean); if(bits.length>=2){ state=machineSlug(bits.pop()); entity=machineSlug(bits.join('_')); } else entity=machineSlug(parts[1]); }
    else { var fn=(parts[0]||'asset').split(/[_\-]+/).filter(Boolean); if(fn.length>=3){ category=machineNormalizeCategory(fn.shift()); state=machineSlug(fn.pop()); entity=machineSlug(fn.join('_')); } else if(fn.length>=2){ state=machineSlug(fn.pop()); entity=machineSlug(fn.join('_')); } else entity=machineSlug(fn[0]||'asset'); }
    if(!entity) entity=machineSlug((machine.bulk.entityPrefix||'asset') + '_' + (machine.items.length+1));
    return {category:category, entity:entity, state:state};
  }

  function machineStateDefaults(category, state){
    category=machineNormalizeCategory(category); state=machineSlug(state);
    var cfg={size:Number(machine.bulk.size)||256, cols:Number(machine.bulk.cols)||1, rows:Number(machine.bulk.rows)||1, fps:Number(machine.bulk.fps)||8, loop:!!machine.bulk.loop, sequenceSpec:String(machine.bulk.sequenceSpec||'').trim(), blackBg:!!machine.bulk.blackBg};
    if(category==='effects'){ cfg.cols=Math.max(1,cfg.cols||4); cfg.rows=Math.max(1,cfg.rows||4); cfg.fps=cfg.fps||12; cfg.loop=false; }
    if(category==='bullets'){ cfg.cols=1; cfg.rows=1; cfg.fps=24; cfg.loop=true; }
    if(category==='pickups' || category==='equipment' || category==='deco'){ cfg.cols=1; cfg.rows=1; cfg.fps=6; cfg.loop=true; }
    if(['death','impact','play','break'].indexOf(state)>=0) cfg.loop=false;
    if(['patrol','idle','thrust','travel','aggro','fire'].indexOf(state)>=0) cfg.loop=true;
    return cfg;
  }

  function machineBuildPromptPack(items){ var lines=['# BONZOOKAA Sprite Generation Machine — Prompt Pack','','Canonical path rule: assets/sprites/<category>/<entity>/<state>.png','']; items.forEach(function(item, idx){ var subject=item.subject||(item.category+' '+item.entity+' '+item.state).replace(/_/g,' '); lines.push('## ' + (idx+1) + '. ' + item.category + '/' + item.entity + '/' + item.state); lines.push('Path: `assets/' + item.file + '`'); lines.push(''); lines.push('### Compressed Prompt'); lines.push('```text'); lines.push(machinePromptCompressed(subject, item.blackBg, item.styleNotes)); lines.push('```'); lines.push(''); lines.push('### Detailed Production Prompt'); lines.push('```text'); lines.push(machinePromptDetailed(subject, item.blackBg, item.styleNotes)); lines.push('```'); lines.push(''); }); return lines.join('\n'); }
  function machineBuildCsv(items){ var head=['category','entity','state','file','size','cols','rows','frames','fps','loop','sequenceSpec','subject']; var rows=[head.join(',')]; items.forEach(function(item){ var vals=[item.category,item.entity,item.state,item.file,item.size,item.cols,item.rows,item.frames,item.fps,item.loop?'true':'false',item.sequenceSpec||'',item.subject||'']; rows.push(vals.map(function(v){ v=String(v==null?'':v).replace(/"/g,'""'); return '"'+v+'"'; }).join(',')); }); return rows.join('\n'); }
  function machineImageMeta(dataUrl){ return new Promise(function(resolve,reject){ var img=new Image(); img.onload=function(){ resolve({width:img.width,height:img.height,dataUrl:dataUrl}); }; img.onerror=reject; img.src=dataUrl; }); }
  function machineReadFileAsDataUrl(file){ return new Promise(function(resolve,reject){ var r=new FileReader(); r.onload=function(){ resolve(r.result); }; r.onerror=reject; r.readAsDataURL(file); }); }

  function machineRenderSummary(){ var el=document.getElementById('machineSummary'); if(!el) return; var total=machine.items.length, entities={}; machine.items.forEach(function(it){entities[it.category+'/'+it.entity]=true;}); var warn=machineValidate(false); el.innerHTML='<span class="machine-stat">Assets: '+total+'</span><span class="machine-stat">Entities: '+Object.keys(entities).length+'</span><span class="machine-stat">Warnings: '+warn.length+'</span>' + (machine.lastImportedAt?('<span class="machine-stat">Imported: '+machine.lastImportedAt+'</span>'):''); }
  function machineSyncBulkFromUi(){ if(!document.getElementById('mBulkCategory')) return; machine.bulk.category=document.getElementById('mBulkCategory').value; machine.bulk.entityPrefix=document.getElementById('mBulkEntityPrefix').value; machine.bulk.state=document.getElementById('mBulkState').value; machine.bulk.size=Number(document.getElementById('mBulkSize').value)||256; machine.bulk.cols=Number(document.getElementById('mBulkCols').value)||1; machine.bulk.rows=Number(document.getElementById('mBulkRows').value)||1; machine.bulk.fps=Number(document.getElementById('mBulkFps').value)||8; machine.bulk.sequenceSpec=document.getElementById('mBulkSeq').value.trim(); machine.bulk.loop=!!document.getElementById('mBulkLoop').checked; machine.bulk.blackBg=!!document.getElementById('mBulkBlack').checked; machine.bulk.styleNotes=document.getElementById('mBulkStyle').value; }

  function machineValidate(showAlert){ var warnings=[], seen={}; machine.items.forEach(function(item){ var key=item.category+'/'+item.entity+'/'+item.state; if(seen[key]) warnings.push('Duplicate state target: '+key); seen[key]=true; if(!item.entity||!item.state) warnings.push('Missing entity/state for '+(item.rawName||item.file)); if((item.cols*item.rows) < item.frames) warnings.push('Frame count exceeds grid slots: '+key); if(item.sequenceSpec && !/^\s*\d+(\s*[-,]\s*\d+)*\s*$/.test(item.sequenceSpec)) warnings.push('Sequence spec looks malformed: '+key+' → '+item.sequenceSpec); }); if(showAlert) alert(warnings.length ? warnings.join('\n') : 'No structural warnings.'); return warnings; }
  function machineApplySelectedDefaults(){ var item=machine.items[machine.selected]; if(!item) return; var defs=machineStateDefaults(item.category,item.state); item.size=defs.size; item.cols=defs.cols; item.rows=defs.rows; item.fps=defs.fps; item.loop=defs.loop; if(!item.sequenceSpec) item.sequenceSpec=defs.sequenceSpec||''; if(!item.styleNotes) item.styleNotes=machine.bulk.styleNotes; machineRenderList(); }
  function machineRemoveSelected(){ if(machine.selected<0) return; machine.items.splice(machine.selected,1); if(machine.selected>=machine.items.length) machine.selected=machine.items.length-1; machineRenderList(); }
  function machineUpdateField(idx, field, value){ var item=machine.items[idx]; if(!item) return; if(['entity','state','category'].indexOf(field)>=0) value=machineSlug(value); if(field==='loop'||field==='blackBg') value=String(value)==='true'; if(['size','cols','rows','fps','frames'].indexOf(field)>=0) value=Math.max(1, parseInt(value,10)||1); item[field]=value; if(['category','entity','state'].indexOf(field)>=0) item.file=machinePathFor(item); machineRenderList(); }

  function machineSyncInspector(){
    var box=document.getElementById('machineInspector'); if(!box) return;
    if(machine.selected<0 || !machine.items[machine.selected]){ box.innerHTML='<div class="machine-note">Select an imported asset to edit exact metadata, selective frame sequences, and generation prompt wording.</div>'; return; }
    var item=machine.items[machine.selected];
    box.innerHTML='<div class="machine-thumb" style="height:180px"><img src="'+item.dataUrl+'"></div>'
      + '<div class="machine-fields">'
      + '<label>Category<select onchange="machineUpdateField('+machine.selected+',\'category\', this.value)">' + ['player','enemies','elites','bosses','pickups','equipment','effects','bullets','deco'].map(function(v){ return '<option value="'+v+'"'+(v===item.category?' selected':'')+'>'+v+'</option>'; }).join('') + '</select></label>'
      + '<label>Entity<input value="'+item.entity+'" onchange="machineUpdateField('+machine.selected+',\'entity\', this.value)"></label>'
      + '<label>State<input value="'+item.state+'" onchange="machineUpdateField('+machine.selected+',\'state\', this.value)"></label>'
      + '<label>Size<input type="number" min="64" max="1024" value="'+item.size+'" onchange="machineUpdateField('+machine.selected+',\'size\', this.value)"></label>'
      + '<label>Cols<input type="number" min="1" max="32" value="'+item.cols+'" onchange="machineUpdateField('+machine.selected+',\'cols\', this.value)"></label>'
      + '<label>Rows<input type="number" min="1" max="32" value="'+item.rows+'" onchange="machineUpdateField('+machine.selected+',\'rows\', this.value)"></label>'
      + '<label>FPS<input type="number" min="1" max="60" value="'+item.fps+'" onchange="machineUpdateField('+machine.selected+',\'fps\', this.value)"></label>'
      + '<label>Frames<input type="number" min="1" max="256" value="'+item.frames+'" onchange="machineUpdateField('+machine.selected+',\'frames\', this.value)"></label>'
      + '</div>'
      + '<div class="machine-fields" style="margin-top:8px">'
      + '<label>Loop<select onchange="machineUpdateField('+machine.selected+',\'loop\', this.value)"><option value="true"'+(item.loop?' selected':'')+'>true</option><option value="false"'+(!item.loop?' selected':'')+'>false</option></select></label>'
      + '<label>Black BG<select onchange="machineUpdateField('+machine.selected+',\'blackBg\', this.value)"><option value="true"'+(item.blackBg?' selected':'')+'>true</option><option value="false"'+(!item.blackBg?' selected':'')+'>false</option></select></label>'
      + '</div>'
      + '<label style="display:block;margin-top:8px;font-size:11px;color:#90a4bd">Selective Frames / Sequence Spec<input value="'+(item.sequenceSpec||'')+'" placeholder="e.g. 3,6,9 or 1-4,7" onchange="machineUpdateField('+machine.selected+',\'sequenceSpec\', this.value)"></label>'
      + '<label style="display:block;margin-top:8px;font-size:11px;color:#90a4bd">Subject<textarea onchange="machineUpdateField('+machine.selected+',\'subject\', this.value)">'+(item.subject||'')+'</textarea></label>'
      + '<label style="display:block;margin-top:8px;font-size:11px;color:#90a4bd">Style Notes<textarea onchange="machineUpdateField('+machine.selected+',\'styleNotes\', this.value)">'+(item.styleNotes||'')+'</textarea></label>'
      + '<div class="machine-actions"><button class="btn" onclick="machineApplySelectedDefaults()">Reapply State Defaults</button><button class="btn danger" onclick="machineRemoveSelected()">Remove Asset</button></div>'
      + '<div class="machine-mini">Exact runtime path: assets/'+item.file+'</div>';
  }

  function machineRenderList(){
    machineRenderSummary(); var list=document.getElementById('machineList'); var warn=document.getElementById('machineWarnings'); if(!list||!warn) return; var warnings=machineValidate(false); warn.textContent=warnings.length ? warnings.join('\n') : 'No structural warnings. Canonical export path is clean.'; list.innerHTML='';
    if(!machine.items.length){ list.innerHTML='<div class="machine-note">Drop PNG files, a ZIP bundle, or existing assets/sprites folders here. The machine will infer category/entity/state, generate manifest-ready rows, prompt packs, and exact export paths.</div>'; machineSyncInspector(); return; }
    machine.items.forEach(function(item, idx){ var div=document.createElement('div'); div.className='machine-item' + (idx===machine.selected ? ' sel':''); div.onclick=function(){ machine.selected=idx; machineRenderList(); machineSyncInspector(); }; div.innerHTML='<div class="mh"><div><div class="mpath">'+item.category+'/'+item.entity+'/'+item.state+'</div><div class="mmeta">'+item.file+'</div></div><div class="mmeta">'+item.width+'×'+item.height+'</div></div><div class="machine-thumb"><img src="'+item.dataUrl+'"></div><div class="machine-fields"><label>Cols<input type="number" min="1" max="32" value="'+item.cols+'" onchange="machineUpdateField('+idx+',\'cols\', this.value)"></label><label>Rows<input type="number" min="1" max="32" value="'+item.rows+'" onchange="machineUpdateField('+idx+',\'rows\', this.value)"></label><label>FPS<input type="number" min="1" max="60" value="'+item.fps+'" onchange="machineUpdateField('+idx+',\'fps\', this.value)"></label><label>Frames<input type="number" min="1" max="256" value="'+item.frames+'" onchange="machineUpdateField('+idx+',\'frames\', this.value)"></label></div><div class="machine-mini">sequence: '+(item.sequenceSpec || '(full range)')+' | loop: '+(item.loop ? 'yes':'no')+'</div>'; list.appendChild(div); }); machineSyncInspector();
  }

  async function machineAddEntryFromData(name, dataUrl){
    var inferred=machineInferPath(name), defs=machineStateDefaults(inferred.category, inferred.state), meta=await machineImageMeta(dataUrl);
    var item={ rawName:name, category:inferred.category, entity:inferred.entity, state:inferred.state, size:defs.size, cols:defs.cols, rows:defs.rows, fps:defs.fps, frames:Math.max(1, defs.cols*defs.rows), loop:defs.loop, sequenceSpec:defs.sequenceSpec||'', blackBg:defs.blackBg, styleNotes:machine.bulk.styleNotes, subject:(inferred.entity+' '+inferred.state).replace(/_/g,' '), dataUrl:dataUrl, width:meta.width, height:meta.height };
    item.file=machinePathFor(item); machine.items.push(item); machine.selected=machine.items.length-1;
  }

  async function machineImportFiles(files){
    machineSyncBulkFromUi(); var list=Array.prototype.slice.call(files||[]).filter(function(f){ return /\.png$/i.test(f.name) || /\.zip$/i.test(f.name); });
    for(var i=0;i<list.length;i++){
      var file=list[i];
      if(/\.zip$/i.test(file.name)){
        var zip=await JSZip.loadAsync(file), names=Object.keys(zip.files);
        for(var z=0; z<names.length; z++){ var name=names[z]; if(zip.files[name].dir || !/\.png$/i.test(name)) continue; var b64=await zip.files[name].async('base64'); await machineAddEntryFromData(name, 'data:image/png;base64,'+b64); }
      } else {
        var dataUrl=await machineReadFileAsDataUrl(file); await machineAddEntryFromData(file.webkitRelativePath || file.name, dataUrl);
      }
    }
    machine.lastImportedAt=new Date().toLocaleString(); machineRenderList();
  }

  function machineEnsureEntity(item){ var key=item.category+'/'+item.entity; if(!SD[key]) SD[key]={cat:item.category, eid:item.entity, size:item.size, states:{}}; SD[key].cat=item.category; SD[key].eid=item.entity; SD[key].size=item.size; if(!SD[key].states) SD[key].states={}; return key; }
  function machineApplyToStudio(){ if(!machine.items.length){ alert('No imported assets available.'); return; } machineSyncBulkFromUi(); machine.items.forEach(function(item){ item.file=machinePathFor(item); var key=machineEnsureEntity(item); var base64=item.dataUrl.split(',')[1]; SD[key].states[item.state]={ file:item.file, cols:item.cols, rows:item.rows, frames:item.frames, fps:item.fps, loop:item.loop, sequenceSpec:item.sequenceSpec||'', thumb:base64, full:base64 }; ensureChangeBucket(key)[item.state]={ file:item.file, cols:item.cols, rows:item.rows, frames:item.frames, fps:item.fps, loop:item.loop, sequenceSpec:item.sequenceSpec||'', full:base64 }; }); buildEntityList(); updateStats(); if(machine.items[0]) selectEntity(machine.items[0].category+'/'+machine.items[0].entity); alert('Generation Machine assets have been wired into the Sprite Studio dataset and exact runtime paths.'); }
  async function machineExportBundle(){ if(!machine.items.length){ alert('No imported assets available.'); return; } machineApplyToStudio(); var zip=new JSZip(); machine.items.forEach(function(item){ zip.file('assets/' + item.file, item.dataUrl.split(',')[1], {base64:true}); }); zip.file('assets/sprite_manifest.json', JSON.stringify(buildManifest(), null, 2)); zip.file('tools/generated/sprite_rows.csv', machineBuildCsv(machine.items)); zip.file('tools/generated/prompt_pack.md', machineBuildPromptPack(machine.items)); zip.file('tools/generated/README.txt', 'Generated by BONZOOKAA Sprite Generation Machine.\nDrop this assets folder into the project root, then replace assets/sprite_manifest.json if desired.'); var blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'}); triggerDL(blob,'bonzookaa_generation_machine_bundle.zip'); }
  function machineDownloadPromptPack(){ if(!machine.items.length){ alert('No imported assets available.'); return; } triggerDL(new Blob([machineBuildPromptPack(machine.items)], {type:'text/markdown'}), 'prompt_pack.md'); }
  function machineDownloadCsv(){ if(!machine.items.length){ alert('No imported assets available.'); return; } triggerDL(new Blob([machineBuildCsv(machine.items)], {type:'text/csv'}), 'sprite_rows.csv'); }
  function machineApplyBulkDefaults(){ machineSyncBulkFromUi(); machine.items.forEach(function(item){ var defs=machineStateDefaults(machine.bulk.category || item.category, item.state); item.size=machine.bulk.size || defs.size; item.cols=machine.bulk.cols || defs.cols; item.rows=machine.bulk.rows || defs.rows; item.fps=machine.bulk.fps || defs.fps; item.frames=Math.max(1, item.cols*item.rows); item.loop=machine.bulk.loop; item.sequenceSpec=machine.bulk.sequenceSpec || item.sequenceSpec || ''; item.blackBg=machine.bulk.blackBg; if(!item.styleNotes) item.styleNotes=machine.bulk.styleNotes; }); machineRenderList(); }
  function machineClearAll(){ machine.items=[]; machine.selected=-1; machineRenderList(); }

  function machineRender(){
    var panel=document.getElementById('contentArea'); if(!panel) return;
    panel.innerHTML='<h3 style="color:#ff6600;font-size:14px;margin-bottom:10px">Sprite Generation Machine</h3>'
      + '<p style="color:#889;font-size:11px;margin-bottom:12px">Purpose-built to kill the manual spreadsheet/manifest grind: bulk ingest PNG or ZIP assets, infer canonical runtime paths, set selective frame sequences, generate BONZOOKAA-safe prompts, and export a ready-to-wire bundle.</p>'
      + '<div class="machine-wrap"><div>'
      + '<div class="machine-card"><h4>Bulk Ingest</h4><div id="machineZone" class="machine-zone">Drop PNG files or a ZIP bundle here<br><span class="machine-mini">Paths like assets/sprites/effects/explosion_small/play.png are parsed automatically.</span></div><input id="machineInput" type="file" accept=".png,.zip" multiple style="display:none"><div id="machineSummary" style="margin-top:10px"></div><div class="machine-actions"><button class="btn" onclick="document.getElementById(\'machineInput\').click()">Choose Files</button><button class="btn" onclick="machineValidate(true)">Validate</button><button class="btn danger" onclick="machineClearAll()">Clear</button></div></div>'
      + '<div class="machine-card"><h4>Bulk Defaults</h4><div class="machine-fields">'
      + '<label>Category<select id="mBulkCategory" onchange="machineSyncBulkFromUi()">' + ['player','enemies','elites','bosses','pickups','equipment','effects','bullets','deco'].map(function(v){ return '<option value="'+v+'"'+(v===machine.bulk.category?' selected':'')+'>'+v+'</option>'; }).join('') + '</select></label>'
      + '<label>Entity Prefix<input id="mBulkEntityPrefix" value="'+machine.bulk.entityPrefix+'" onchange="machineSyncBulkFromUi()"></label>'
      + '<label>State<input id="mBulkState" value="'+machine.bulk.state+'" onchange="machineSyncBulkFromUi()"></label>'
      + '<label>Size<input id="mBulkSize" type="number" min="64" max="1024" value="'+machine.bulk.size+'" onchange="machineSyncBulkFromUi()"></label>'
      + '<label>Cols<input id="mBulkCols" type="number" min="1" max="32" value="'+machine.bulk.cols+'" onchange="machineSyncBulkFromUi()"></label>'
      + '<label>Rows<input id="mBulkRows" type="number" min="1" max="32" value="'+machine.bulk.rows+'" onchange="machineSyncBulkFromUi()"></label>'
      + '<label>FPS<input id="mBulkFps" type="number" min="1" max="60" value="'+machine.bulk.fps+'" onchange="machineSyncBulkFromUi()"></label>'
      + '<label>Selective Frames<input id="mBulkSeq" value="'+machine.bulk.sequenceSpec+'" placeholder="3,6,9" onchange="machineSyncBulkFromUi()"></label>'
      + '</div><div class="machine-actions"><label class="machine-stat"><input id="mBulkLoop" type="checkbox" '+(machine.bulk.loop ? 'checked':'')+' onchange="machineSyncBulkFromUi()"> loop</label><label class="machine-stat"><input id="mBulkBlack" type="checkbox" '+(machine.bulk.blackBg ? 'checked':'')+' onchange="machineSyncBulkFromUi()"> black-bg ready</label></div><label style="display:block;margin-top:8px;font-size:11px;color:#90a4bd">Style Notes<textarea id="mBulkStyle" onchange="machineSyncBulkFromUi()">'+machine.bulk.styleNotes+'</textarea></label><div class="machine-actions"><button class="btn" onclick="machineApplyBulkDefaults()">Apply Defaults To All</button><button class="btn ok" onclick="machineApplyToStudio()">Wire Into Studio</button></div><div class="machine-mini">Use selective frame specs for short impact animations from larger sheets, e.g. 3,6,9 or 1-4,7.</div></div>'
      + '<div class="machine-card"><h4>Selected Asset Inspector</h4><div id="machineInspector"></div></div>'
      + '<div class="machine-card"><h4>Warnings</h4><div id="machineWarnings" class="machine-warn"></div></div>'
      + '<div class="machine-card"><h4>Exports</h4><div class="machine-actions"><button class="btn or" onclick="machineExportBundle()">Export Bundle ZIP</button><button class="btn" onclick="machineDownloadCsv()">Rows CSV</button><button class="btn" onclick="machineDownloadPromptPack()">Prompt Pack</button></div><div class="machine-note" style="margin-top:8px">Bundle includes canonical PNG paths, assets/sprite_manifest.json, a CSV row export for spreadsheet workflows, and a BONZOOKAA prompt pack for regeneration or refinement.</div></div>'
      + '</div><div><div class="machine-card"><h4>Imported Assets</h4><div id="machineList" class="machine-grid"></div></div></div></div>';
    var zone=document.getElementById('machineZone'), input=document.getElementById('machineInput');
    zone.onclick=function(){ input.click(); }; zone.ondragover=function(e){ e.preventDefault(); zone.style.borderColor='#00ccff'; }; zone.ondragleave=function(){ zone.style.borderColor=''; }; zone.ondrop=function(e){ e.preventDefault(); zone.style.borderColor=''; machineImportFiles(e.dataTransfer.files); }; input.onchange=function(){ machineImportFiles(input.files); input.value=''; };
    machineRenderList();
  }

  var origSetMode=window.setMode;
  window.setMode=function(m){
    mode=m; document.querySelectorAll('.mode-tab').forEach(function(t){ t.classList.toggle('active', t.textContent.toLowerCase().indexOf(m) >= 0); });
    if(m==='machine'){ machineRender(); return; }
    return origSetMode.call(this, m);
  };
  function injectMachineTab(){ var tabs=document.querySelector('.mode-tabs'); if(!tabs || document.getElementById('machineModeTab')) return; var btn=document.createElement('div'); btn.id='machineModeTab'; btn.className='mode-tab'; btn.textContent='Generation Machine'; btn.onclick=function(){ setMode('machine'); }; tabs.appendChild(btn); }
  injectMachineTab();
  window.machineRender=machineRender; window.machineImportFiles=machineImportFiles; window.machineApplyToStudio=machineApplyToStudio; window.machineExportBundle=machineExportBundle; window.machineValidate=machineValidate; window.machineUpdateField=machineUpdateField; window.machineApplySelectedDefaults=machineApplySelectedDefaults; window.machineRemoveSelected=machineRemoveSelected; window.machineDownloadPromptPack=machineDownloadPromptPack; window.machineDownloadCsv=machineDownloadCsv; window.machineSyncBulkFromUi=machineSyncBulkFromUi; window.machineApplyBulkDefaults=machineApplyBulkDefaults; window.machineClearAll=machineClearAll;
})();
