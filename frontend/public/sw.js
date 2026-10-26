const CACHE = 'kanban-shell-v1';
const SHELL = ['/offline.html','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install', event => {event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate', event => event.waitUntil((async()=>{for(const key of await caches.keys())if(key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin)return;
  // Never cache authenticated HTML, server functions, session tokens or API responses.
  if(req.mode==='navigate') {event.respondWith(fetch(req).catch(()=>caches.match('/offline.html')));return;}
  if(SHELL.includes(url.pathname)||url.pathname.startsWith('/assets/'))event.respondWith((async()=>{const cache=await caches.open(CACHE),cached=await cache.match(req);if(cached)return cached;const response=await fetch(req);if(response.ok)await cache.put(req,response.clone());return response;})());
});
self.addEventListener('push',event=>{if(!event.data)return;let data;try{data=event.data.json();}catch{return;}event.waitUntil(self.registration.showNotification(data.title||'Kanban',{body:data.body,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:data.taskId?`task-${data.taskId}`:'kanban-digest',data,actions:data.taskId?[{action:'done',title:'Done'},{action:'snooze',title:'Snooze 1h'}]:[]}));});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const data=event.notification.data||{};
  event.waitUntil((async()=>{
    if(['done','snooze'].includes(event.action)&&data.taskId){try{const response=await fetch(data.actionUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:data.actionToken,taskId:data.taskId,action:event.action})});if(response.ok)return;}catch{}await self.registration.showNotification('Action could not be saved',{body:'Open Kanban when you’re online to try again.',icon:'/icons/icon-192.png'});}
    const url=new URL(data.url||'/today',self.location.origin);if(url.origin!==self.location.origin)return;
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const client=clients.find(c=>new URL(c.url).origin===self.location.origin);if(client){await client.navigate(url.href);await client.focus();}else await self.clients.openWindow(url.href);
  })());
});
self.addEventListener('message',event=>{if(event.data?.type==='CLEAR_USER')event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));});
