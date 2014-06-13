function HookCollection(){
  this.collection = {};
	this.counter = 0;
};
HookCollection.prototype.empty = function(){
	var c = 0;
	for(var n in this.collection){
		return false;
	}
  return true;
};
HookCollection.prototype.inc = function(){
	var t = this;
	function _inc(){
		t.counter++;
		if(t.counter>10000000){
			t.counter=1;
		}
	};
	_inc();
	while(this.counter in this.collection){
		_inc();
	}
};
HookCollection.prototype.attach = function(cb){
  if(typeof cb === 'function'){
		this.inc();
    this.collection[this.counter]=cb;
    //console.log('attached',cb,'to',this.counter);
		return this.counter;
  }
};
HookCollection.prototype.detach = function(i){
  if(!this.collection){
    return;
  }
  if(!this.collection[i]){
    console.trace();
    console.warn('no event handler for',i);
  }
	delete this.collection[i];
};
HookCollection.prototype.fire = function(){
  var c = this.collection;
  var fordel=[];
  var pa = Array.prototype.slice.call(arguments);
  //console.log('firing on',c);
  for(var i in c){
    try{
      var fqn = c[i];
      //console.log('calling',fqn,'on',i,'with',pa);
      fqn.apply(null,pa);
    }
    catch(e){
      console.log(e);
      console.log(e.stack);
      fordel.unshift(i);
    }
  }
  var fdl = fordel.length;
  for(var i=0; i<fdl; i++){
		delete c[fordel[i]];
  }
};
/* controversial
HookCollection.prototype.fireAndForget = function(){
  var c = this.collection;
  var pa = Array.prototype.slice.call(arguments);
  for(var i in c){
    try{
      c[i].apply(null,pa);
    }
    catch(e){
      console.log(e);
      console.log(e.stack);
    }
  }
	this.collection = {};
}
*/
HookCollection.prototype.destruct = function(){
  for(var i in this){
    delete this[i];
  }
}
function dummyHook(){};
function createListener(hook,cb){
  var hi = hook.attach(cb);
  var ret = {destroy:function(){
    hook.detach(hi);
    cb = null;
    hi = null;
    ret.destroy = dummyHook;
  }}
  return ret;
};
function createCtxActivator(ctx,cb){
  return function(){
    cb.apply(ctx,arguments);
  }
}
function CompositeHookCollection(){
  this.hook = new HookCollection();
  this.subhooks = {};
};
CompositeHookCollection.prototype.listen = function(cb){
  return createListener(this.hook,cb);
};
CompositeHookCollection.prototype.sublisten = function(name,cb){
  var sh = this.subhooks[name];
  if(!sh){
    sh = new HookCollection();
    this.subhooks[name] = sh;
  }
  return createListener(sh,cb);
};
CompositeHookCollection.prototype.subsublisten = function(name,other,cb){
  if(!this.subsubhooks){
    this.subsubhooks = {};
  }
  var ssh = this.subsubhooks[name+'|'+other];
  if(!ssh){
    ssh = new HookCollection();
    this.subsubhooks[name+'|'+other] = ssh;
  }
  return createListener(ssh,cb);
};
CompositeHookCollection.prototype.fire = function(){
  var args = Array.prototype.slice.call(arguments);
  this.hook.fire.apply(this.hook,args);
  var name = args.shift();
  if(this.subhooks){
    var sh = this.subhooks[name];
    if(sh){
      sh.fire.apply(sh,args);
    }
  }
  if(this.subsubhooks){
    var other = args.shift();
    if(other){
      var ssh = this.subsubhooks[name+'|'+other];
      if(ssh){
        ssh.fire.apply(ssh,args);
      }
    }
  }
};
CompositeHookCollection.prototype.destruct = function(){
  this.hook.destruct();
  for(var i in this.subhooks){
    this.subhooks[i].destruct();
  }
  delete this.subhooks;
  if(this.subsubhooks){
    for(var i in this.subsubhooks){
      this.subsubhooks[i].destruct();
    }
    delete this.subsubhooks;
  }
};

function CompositeListener(follower){
  this.follower = follower;
  this.listeners = {};
};
CompositeListener.prototype._getClearListener = function(name){
  var sl = this.listeners[name];
  if(sl){
    for(var i in sl){
      sl[i].destroy();
    }
    sl={};
  }else{
    sl={};
    this.listeners[name] = sl;
  }
  return sl;
};
CompositeListener.prototype.listenToScalars = function(listenerpack){
  var sl = this._getClearListener('/scalars/');
  var la = listenerpack.activator;
  var ss = this.follower.scalars;
  if(la){
    sl.a = this.follower.newScalar.listen(la);
    for(var i in ss){
      la(i);
    }
  }
  var ls = listenerpack.setter;
  if(ls){
    sl.s = this.follower.scalarChanged.listen(ls);
    for(var i in ss){
      ls(i,ss[i]);
    }
  }
  var ld = listenerpack.deactivator;
  if(ld){
    sl.d = this.follower.scalarRemoved.listen(ld);
  }
};
CompositeListener.prototype.addScalar = function(scalarname,listenerpack){
  var sl = this._getClearListener(scalarname);
  var sv = this.follower.scalars[scalarname];
  var la = listenerpack.activator;
  if(la){
    sl.a = this.follower.newScalar.sublisten(scalarname,la);
    if(typeof sv !== 'undefined'){
      la();
    }
  }
  var ls = listenerpack.setter;
  if(ls){
    sl.s = this.follower.scalarChanged.sublisten(scalarname,ls);
    if(typeof sv !== 'undefined'){
      ls(sv);
    }
  }
  var ld = listenerpack.deactivator;
  if(ld){
    sl.d = this.follower.scalarRemoved.sublisten(scalarname,ld);
  }
};
CompositeListener.prototype.listenToUsers = function(listenerpack){
  var sl = this._getClearListener('/users/');
  var la = listenerpack.activator;
  if(la){
    sl.a = this.follower.newUser.listen(la);
    for(var _r in this.follower.realms){
      var r = this.follower.realms[_r];
      for(var _un in r){
        la(_un,_r);
      }
    }
  }
  var ld = listenerpack.deactivator;
  if(ld){
    sl.d = this.follower.userRemoved.listen(ld);
  }
};
CompositeListener.prototype.addUser = function(username,realmname,listenerpack){
  var sl = this._getClearListener(collectionname);
  var la = listenerpack.activator;
  if(la){
    sl.a = this.follower.newCollection.subsublisten(username,realmname,la);
    var r = this.follower.realms[realmname];
    if(typeof r !== 'undefined' && r.indexOf(username) >= 0){
      la();
    }
  }
  var ld = listenerpack.deactivator;
  if(ld){
    sl.d = this.follower.userRemoved.subsublisten(username,realmname,ld);
  }
};
CompositeListener.prototype.listenToCollections = function(listenerpack){
  var sl = this._getClearListener('/collections/');
  var la = listenerpack.activator;
  if(la){
    sl.a = this.follower.newCollection.listen(la);
    for(var i in this.follower.collections){
      la(i);
    }
  }
  var ld = listenerpack.deactivator;
  if(ld){
    sl.d = this.follower.collectionRemoved.listen(ld);
  }
};
CompositeListener.prototype.addCollection = function(collectionname,listenerpack){
  var sl = this._getClearListener(collectionname);
  var la = listenerpack.activator;
  if(la){
    sl.a = this.follower.newCollection.sublisten(collectionname,la);
    if(typeof this.follower.collections[collectionname] !== 'undefined'){
      la();
    }
  }
  var ld = listenerpack.deactivator;
  if(ld){
    sl.d = this.follower.collectionRemoved.sublisten(collectionname,ld);
  }
};
CompositeListener.prototype.destroy = function(){
  delete this.follower;
  for(var i in this.listeners){
    var l = this.listeners[i];
    if(typeof l.destroy === 'function'){
      l.destroy();
    }
    for(var i in l){
      var _l = l[i];
      if(typeof _l.destroy === 'function'){
        _l.destroy();
      }
      delete l[i];
    }
    delete this.listeners[i];
  }
  delete this.listeners;
};

function Follower(commander){
  if(!commander){
    return;
  }
  this.setCommander(commander);
};

Follower.prototype.getPath = function () {
  var ret = '';
  for (var i in this.path) {
    if (ret.length) ret+='/';
    if (this.path[i] instanceof Array) {
      ret += this.path[i][0];
      continue;
    }else {
      ret += this.path[i];
    }
  }
  return ret;
};


Follower.prototype.do_command = function(command,paramobj,statuscb,ctx){
  if(ctx&&!statuscb){
    throw "got ctx and no cb?";
  }
  (typeof this.commander === 'function') && this.commander(command,paramobj,ctx?function(){
    statuscb.apply(ctx,arguments);
  }:statuscb);
};
Follower.prototype.username = function(){
  return Follower.username;
};

Follower.prototype.realmname = function () {
  return Follower.realmname;
}

Follower.prototype.full_username = function () {
  return this.username()+'@'+this.realmname();
}

Follower.prototype.setCommander = function(fn){
  this.commander = fn;
  this.scalars = {};
  this.collections = {};
  this.realms = {};
  this.txnBegins = new CompositeHookCollection();
  this.txnEnds = new CompositeHookCollection();
  this.newScalar = new CompositeHookCollection();
  this.scalarChanged = new CompositeHookCollection();
  this.scalarRemoved = new CompositeHookCollection();
  this.newCollection = new CompositeHookCollection();
  this.collectionRemoved = new CompositeHookCollection();
  this.newRealm = new CompositeHookCollection();
  this.newUser = new CompositeHookCollection();
  this.realmRemoved = new CompositeHookCollection();
  this.userRemoved = new CompositeHookCollection();
  this.onReset = new CompositeHookCollection();
  this.destroyed = new CompositeHookCollection();
  this.followers={};
};
Follower.prototype.deleteScalar = function(scalarname){
  if(typeof this.scalars[scalarname] !== 'undefined'){
    this.scalarChanged.fire(scalarname,undefined,this.scalars[scalarname]);
    this.scalarRemoved.fire(scalarname);
    delete this.scalars[scalarname];
  }
};
Follower.prototype.deleteCollection = function(collectionname){
  if(typeof this.collections[collectionname] !== 'undefined'){
    this.collectionRemoved.fire(collectionname);
    /* leave the follower
    if(this.followers[collectionname]){
      this.followers[collectionname].destroy();
      delete this.followers[collectionname];
    }
    */
    delete this.collections[collectionname];
  }
};
Follower.prototype.pathOf = function(pathelem,passthru){
  //var pe = passthru ? [[pathelem,true]] : [pathelem];
  var pe = [pathelem];
  if(this.path){
    return typeof pathelem === 'undefined' ? this.path : this.path.concat(pe);
  }else{
    return typeof pathelem === 'undefined' ? [] : pe ;
  }
};
Follower.prototype.childFollower = function(name,passthru){
  var f = this.followers[name];
  if(f){
    return f;
  }
  var t = this;
  f = new Follower(function(command,paramobj,statuscb){
    var fc = command.charAt(0);
    if(fc!=='/' && fc!==':'){
      command = name+'/'+command;
    }
    t.do_command(command,paramobj,statuscb);
  });
  var fp = this.pathOf(name,passthru);
  f.path = fp;
  this.followers[name] = f;
  f.destroyed.listen(function(){
    delete t.followers[name];
  });
  return f;
};
Follower.prototype.follow = function(name,passthru){
  if(typeof name === 'undefined'){
    return this;
  }
  if(this.followers[name]){
    return this.followers[name];
  }
  var f = this.childFollower(name,passthru);
  /*
  this.do_command(':follow',f.path,function(errcb){
    if((errcb==='OK') && (typeof this.collections[name] === 'undefined')){
      this.collections[name] = null;
      this.newCollection.fire(name);
    }
  },this);
  */
  return f;
};
Follower.prototype.unfollow = function(name){
  //this.do_command(':unfollow',{path:this.pathOf(name)});
};

Follower.prototype.listenToCollections = function(ctx,listeners){
  for(var i in listeners){
    listeners[i] = createCtxActivator(ctx,listeners[i]);
  }
  var ret = new CompositeListener(this);
  ret.listenToCollections(listeners);
  return ret;
};
Follower.prototype.listenToMultiScalars = function(ctx,scalarnamearry,cb){
  cb = createCtxActivator(ctx,cb);
  var ss = this.scalars;
  function trigger(){
    var combo = {};
    for(var i in scalarnamearry){
      var name = scalarnamearry[i];
      if(typeof ss[name] === 'undefined'){
        return;
      }
      combo[name] = ss[name];
    }
    cb(combo);
  };
  var ret = new CompositeListener(this);
  for(var i in scalarnamearry){
    ret.addScalar(scalarnamearry[i],{setter:trigger});
  }
  return ret;

};
Follower.prototype.listenToScalars = function(ctx,listeners){
  for(var i in listeners){
    listeners[i] = createCtxActivator(ctx,listeners[i]);
  }
  var ret = new CompositeListener(this);
  ret.listenToScalars(listeners);
  return ret;
};
Follower.prototype.listenToCollection = function(ctx,name,listeners){
  for(var i in listeners){
    listeners[i] = createCtxActivator(ctx,listeners[i]);
  }
  var ret = new CompositeListener(this);
  ret.addCollection(name,listeners);
  return ret;
};
Follower.prototype.listenToScalar = function(ctx,name,listeners){
  for(var i in listeners){
    listeners[i] = createCtxActivator(ctx,listeners[i]);
  }
  var ret = new CompositeListener(this);
  ret.addScalar(name,listeners);
  return ret;
};
Follower.prototype.listenToJSONScalar = function (ctx, name, listeners) {
	if (listeners.setter) {
		var cb = listeners.setter;
		listeners.setter = function (v, ov) {
      v = ('undefined' !== typeof(v) && v.length) ? JSON.parse(v) : undefined;
      ov = ('undefined' !== typeof(ov) && ov.length) ? JSON.parse(ov) : undefined;
			cb.call(this, v, ov);
		}
	}
	return this.listenToScalar(ctx, name, listeners);
};
Follower.prototype.listenToUsers = function(ctx,listeners){
  for(var i in listeners){
    listeners[i] = createCtxActivator(ctx,listeners[i]);
  }
  var ret = new CompositeListener(this);
  ret.listenToUsers(listeners);
  return ret;
};
Follower.prototype.follower = function(name){
  return this.followers[name];
};
Follower.prototype.performUserOp = function(userop){
  var op = userop[0], un = userop[1], rn = userop[2];
  switch(userop[0]){
    case 1:
      if(!this.realms[rn]){
        this.realms[rn] = [un];
        this.newRealm.fire(rn);
      }else{
        this.realms[rn].push(un);
        this.newUser.fire(un,rn);
      }
      break;
    case 2:
      if(this.realms[rn]){
        var ui = this.realms[rn].indexOf(un);
        if(ui>=0){
          this.userRemoved.fire(un,rn);
          this.realms[rn].splice(ui,1);
          if(!this.realms[rn].length){
            this.realmRemoved.fire(rn);
            delete this.realms[rn];
          }
        }
      }
      break;
  }
};
Follower.prototype._subcommit = function(t){
  if(!(t&&t.length)){return;}
  var name = t[0], value = t[1];
  if(name && name.charAt(0)===':'){
    var methodname = name.substring(1);
    var method = this[methodname];
    if(typeof method === 'function'){
      //console.log(this.path,'invoking',methodname,value);
      method.apply(this,value);
    }else{
      console.log(this.path,'has not method',methodname);
    }
    return;
  }
  //console.log(this.path,name,value);
  switch(t.length){
    case 2:
      if(name===null){
        if(this.txnalias){
          this.txnEnds.fire(value);
          delete this.txnalias;
        }else{
          this.txnalias = value;
          this.txnBegins.fire(value);
        }
        return;
      }
      if(value!==null){
        var sv = this.scalars[name];
        this.scalars[name]=value;
        if(typeof sv === 'undefined'){
          this.newScalar.fire(name,value);
          this.scalarChanged.fire(name,value,sv);
        }else{
          (sv != value) && this.scalarChanged.fire(name,value,sv);
        }
        
      }else{
        //console.log(name,'created');
        if(typeof this.collections[name] !== 'undefined'){
          //throw 'already have '+name+' collection';
          //don't panic, it may be the 'init'
          break;
        }
        this.collections[name]=null;
        //console.log(this.path,'new collection',name);
        /*
        if(this.followers[name]){
          this.followers[name];//??
        }
        */
        this.newCollection.fire(name);
      }
    break;
    case 1:
      /*
      if(typeof this.collections[name] !== 'undefined'){
        console.log(name,'dying');
      }
      */
      this.deleteScalar(name);
      this.deleteCollection(name);
    break;
  }
  return;
  var txnpack = txns[0],txnps = txnpack&&txnpack.length>0?txnpack[0]:[], userops = txnpack&&txnpack.length>1?txnpack[1]:[], chldtxns=txns[1];
  //console.log(this.path?this.path.join('.'):'.','should commit',txnalias,txnps);
  for(var i in userops){
    this.performUserOp(userops[i]);
  }
  this.txnBegins.fire(txnalias);
  for(var j in txnps){
    var t = txnps[j],name=t[0],value=t[1],sv=this.scalars[name],c=this.collections[name];
    switch(t.length){
      case 2:
        //console.log('set',name,value);
        if(value!==null){
          this.scalars[name]=value;
          if(typeof sv === 'undefined'){
            this.newScalar.fire(name,value);
						this.scalarChanged.fire(name,value,sv);
          }else{
						(sv != value) && this.scalarChanged.fire(name,value,sv);
					}
          
        }else{
          if(typeof this.collections[name] !== 'undefined'){
            //throw 'already have '+name+' collection';
            //don't panic, it may be the 'init'
            break;
          }
          this.collections[name]=null;
          //console.log('new collection',name);
          /*
          if(this.followers[name]){
            this.followers[name];//??
          }
          */
          this.newCollection.fire(name);
        }
      break;
      case 1:
        //console.log('delete',name);
        this.deleteScalar(name);
        this.deleteCollection(name);
      break;
    }
  }
  if(txnalias==='init'){
    //look for all mentioned elements to set
    var allinit = {};
    for(var i in txnps){
      if(txnps[i].length===2){
        allinit[txnps[i][0]] = 1;
      }
    }
    for(var i in this.scalars){
      if(!(i in allinit)){
        this.deleteScalar(i);
      }
    }
    for(var i in this.collections){
      if(!(i in allinit)){
        this.deleteCollection(i);
      }
    }
		this.init_done = true;

		/*
    //now, re-awake all the needed followers
    for(var i in this.followers){
      //console.log('awaking follower',i);
      this.do_command('/follow',{path:this.followers[i].path});
    }
		*/
  }
  this.txnEnds.fire(txnalias);
  for(var i in chldtxns){
    var chldtxn=chldtxns[i];
    //console.log('child',i,chldtxn);
    this.childFollower(i)._subcommit(txnalias,chldtxn);
  }
	/*
  if(txnalias==='init'){
    for(var i in this.followers){
      if(!i in allinit){
        this.followers[i]._subcommit(txnalias,[]);
      }
    }
  }
	*/
  //console.log(this.path?this.path.join('.'):'.','finally',this.scalars,this.collections);
};

Follower.prototype.disconnect = function(){
  var s = this.socketio;
  if(s){
    delete this.socketio;
    s=null;
  }
};
Follower.prototype.clear = function() {
  for(var i in this.followers){
    this.followers[i].clear();
  }
  for(var i in this.scalars){
    this.deleteScalar(i);
    //this.deleteCollection(i);
  }
  for (var i in this.collections) {
    this.deleteCollection(i);
  }
};
Follower.prototype.reset = function(){
  for(var i in this.followers){
    this.followers[i].reset();
    this.followers[i].destroy();
    //console.log(this.path,'destroying',i);
    delete this.followers[i];
  }
  this.clear();
  this.onReset.fire();
};
Follower.prototype.refollowServer = function(){
  /*
  this.do_command(':follow',this.path);
  for(var i in this.followers){
    this.followers[i].refollowServer();
  }
  */
};
Follower.prototype._purge = function () {
  this.clear();
  this.refollowServer();
};
Follower.prototype.commitOne = function(primitive){
  if(!primitive){return;}
  var path = primitive[0], target = this;
  //console.log(primitive[0],primitive[1]);
  //console.log(JSON.stringify(primitive));
  while(target && path && path.length){
    var pe = path.shift();
    if(typeof target.collections[pe] === 'undefined'){
      target.collections[pe]=null;
      target.newCollection.fire(pe);
    }
    target = target.childFollower(pe);
  }
  if(target){
    target._subcommit(primitive[1]);
  }
  //if(txnalias==='init') this._purge();
};
Follower.prototype.parseAndCommit = function(txnstr){
  var txn = JSON.parse(txnstr);
  for(var i in txn){
    txn[i] = typeof txn[i] === 'string' ? JSON.parse(txn[i]) : txn[i];
  }
  this.commitOne(txn);
}
Follower.prototype._commit = function(txns){
  if(typeof txns === 'string'){
    console.log('parseAndCommit',txns);
    this.parseAndCommit(txns);
    return;
  }
  this.commitOne(txns);
  if(this.commitqueue && this.commitqueue.length){
    this._commit(this.commitqueue.shift());
  }
};
Follower.prototype.commit = function(txns){
  /*
  for(var i in txns){
    console.log(this.path,txns[i][0],txns[i][1]);
  }
  */
  if(!this.commitqueue){
    this.commitqueue = txns;
  }else{
    this.commitqueue.push.apply(this.commitqueue,txns);
  }
  this._commit(this.commitqueue.shift());
};
Follower.prototype.dump = function(){
};
Follower.prototype.destroy = function(){
  this.txnBegins.destruct();
  this.txnEnds.destruct();
  this.newScalar.destruct();
  this.scalarChanged.destruct();
  this.scalarRemoved.destruct();
  this.newCollection.destruct();
  this.collectionRemoved.destruct();
  this.newRealm.destruct();
  this.newUser.destruct();
  this.realmRemoved.destruct();
  this.userRemoved.destruct();
  this.onReset.destruct();
  this.destroyed.fire();
  this.destroyed.destruct();
};

angular.
  module('HERS', ['btford.socket-io']).
  constant('follower',new Follower()).
  constant('maxattemptspertimeout',5).
  constant('maxtimeout',3).
  value('sessionobj',{}).
  value('identity',{}).
  value('url',window.location.origin||window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port: '')).
  factory('transfer', function($http,$timeout,url,follower,identity,sessionobj,maxattemptspertimeout,maxtimeout,socketFactory){
    var transfer = function(command,queryobj,cb){
      command = command||'';
      var attempts = 0;
      if(sessionobj.name){
        queryobj[sessionobj.name]=sessionobj.value;
      }
      for(var i in identity){
        queryobj[i]=identity[i];
      }
      if(!(queryobj.name&&sessionobj.name)){
        if(follower.anonymousattempts){
          $timeout((function(c,q,cb){
            var _c=c,_q=q,_cb=cb;
            return function(){
              transfer(_c,_q,_cb);
            };
          })(command,queryobj,cb),100);
          return;
        }
        follower.anonymousattempts=1;
      }
      //console.log(command,queryobj);
      queryobj.__timestamp__ = (new Date()).getTime();
      timeout = 1;
      var worker = (function(_cb){
        var cb = _cb;
        var _wrk = function(){
          if(command&&(command[0]!=='/')){
            command = '/'+command;
          }
          $http.get( url+command, {params:queryobj} ).
          success(function(data){
            //console.log(command,'=>',data);
            if(identity.name && data.username!==identity.name){
              console.log('oopsadaisy',data.username,'!==',identity.name);
              if(sessionobj.name){
                delete queryobj[sessionobj.name];
              }
              for(var i in identity){
                queryobj[i] = identity[i];
              }
              sessionobj = {};
              if(data.session){_wrk();}
              else{
                $timeout(_wrk,10000);
              }
              return;
            }
            if(data.session){
              for(var i in data.session){
                if(sessionobj.name!==i){
                  if(sessionobj.name){
                    sessionobj = {};
                    console.log('time for purge');
                    follower._purge();
                    (typeof cb === 'function') && cb();
                    return;
                  }
                }
                sessionobj.name = i;
                if(sessionobj.value!==data.session[i]){
                  //actually, do nothing. 
                  //All is handled in the 'init' txn commit
                }
                sessionobj.value = data.session[i];
              }
              if(!(follower.waitingforsockio||follower.socketio)){
                follower.waitingforsockio=true;
                var sio = socketFactory({ioSocket: io.connect('/?'+sessionobj.name+'='+sessionobj.value+'&username='+data.username,{
                  'reconnect':false,
                  'force new connection':true
                })});
                //console.log('time for socket.io',sio,data);
                sio.on('socket:error', function(reason){
                  __cb();
                });
                sio.on('disconnect', function(){
                  delete follower.socketio;
                  delete follower.anonymousattempts;
                  console.log('calling __cb because disconnect');
                  __cb();
                });
                sio.on('connect', function(){
                  //console.log('socket.io connected');
                  delete follower.waitingforsockio;
                  follower.socketio = sio;
                });
                sio.on('_',function(data){
                  follower.commitOne(data);
                });
              }
            }
            identity.name = data.username;
            identity.realm = data.realmname;
            identity.roles = data.roles ? data.roles.split(',') : [];
            Follower.username = identity.name;
            Follower.realmname = identity.realm;
            if(identity.name){
              //delete follower.anonymousattempts;
            }
            if(data.session){
              data && data.data && follower.commit(data.data);
              (typeof cb === 'function') && cb(data.errorcode,data.errorparams,data.errormessage,data.results);
            }else{
              var __cb=cb;
              $timeout(function(){
                data && data.data && follower.commit(data.data);
                (typeof __cb === 'function') && __cb(data.errorcode,data.errorparams,data.errormessage,data.results);
              },10000);
            }
          }).
          error(function(data,status,headers,config){
            console.log('error',status);
            if(status==401){
              delete identity.name;
              delete identity.realm;
              return;
            }
            attempts++;
            if(attempts>maxattemptspertimeout){
              attempts=0;
              if(timeout<maxtimeout){
                timeout++;
              }
            }
            $timeout(_wrk,timeout*1000);
          });
        };
        return _wrk;
      })(cb);
      worker();
    };
    return transfer;
  }).
  factory('go',function($timeout,transfer,follower,sessionobj){
    return function(){
      var command_sent=false;
      var execute = [];
      var execcb = [];
      function do_results(results){
        if(!results){return;}
        while(results.length){  
          var excb = execcb.shift();
          //console.log(execute[0],execute[1],'=>',results[0]);
          var res = results.shift();
          execute.shift();
          execute.shift();
          excb && excb.apply(null,res);
        }
        if(execute.length && (execute.length == execcb.length*2)){ //new pack
          do_execute();
        }
        //console.log('execcb left',execute);
      };
      function do_execute(cb){
        if(follower.socketio){
          if(!follower.socketio.subscribedtoResult){
            follower.socketio.subscribedtoResult = true;
            follower.socketio.on('=',function(data){
              do_results(data.results);
            });
          }
          follower.socketio.emit('!',execute.slice());
          return;
        }
        command_sent=true;
        var _do_ex = function(){
          transfer('!',{commands:JSON.stringify(execute.slice())},function(errcode,errparams,errmessage,results){
            if(errcode==='NO_SESSION'){
              sessionobj = {};
              _do_ex();
              return;
            }
            do_results(results);
          });
        };
        _do_ex();
      };
      function do_command(command,paramobj,cb){
        var shouldfire = (execute.length===0);
        execute.push(command,paramobj);
        execcb.push(cb);
        //console.log(command,execute.length,execcb.length);
        if(shouldfire){do_execute()}
      };

      follower.setCommander(function(command,paramobj,statuscb){
        do_command(command,paramobj,statuscb);
      });
      var cb = function(){if(follower.socketio){return;}transfer('_',{},cb);};
      cb();
    };
  });



function SystemCtrl($scope,follower){
  $scope.memoryusage=0;
  $scope.memoryavailable=0;
  follower.listenToScalar($scope,'memoryusage',{setter:function(val){
    this.memoryusage=val;
  }});
  follower.listenToScalar($scope,'memoryavailable',{setter:function(val){
    this.memoryavailable=val;
  }});
};
function ConsumerCtrl($scope,follower){
  $scope.consumercount=0;
  follower.listenToScalar($scope,'consumercount',{setter:function(val){
    this.consumercount=val;
  }});
};
function DataSnifferCtrl($scope,follower){
  $scope.dataDump = '';
  follower.txnEnds.attach(function(){
    $scope.dataDump = follower.dump();
  });
};

