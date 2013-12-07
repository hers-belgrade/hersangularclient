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
  //console.log('destructing');
  for(var i in this.collection){
    delete this.collection[i];
  }
}
function createListener(hook,cb){
  var hi = hook.attach(cb);
  return {destroy:function(){
    hook.detach(hi);
  }};
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
CompositeHookCollection.prototype.fire = function(){
  var args = Array.prototype.slice.call(arguments);
  this.hook.fire.apply(this.hook,args);
  var name = args.shift();
  var sh = this.subhooks[name];
  if(sh){
    sh.fire.apply(sh,args);
  }
};
CompositeHookCollection.prototype.destruct = function(){
  this.hook.destruct();
  for(var i in this.subhooks){
    this.subhooks[i].destruct();
  }
  delete this.subhooks;
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
  this.commander = commander;
  this.scalars = {};
  this.collections = {};
  this.txnBegins = new CompositeHookCollection();
  this.txnEnds = new CompositeHookCollection();
  this.newScalar = new CompositeHookCollection();
  this.scalarChanged = new CompositeHookCollection();
  this.scalarRemoved = new CompositeHookCollection();
  this.newCollection = new CompositeHookCollection();
  this.collectionRemoved = new CompositeHookCollection();
  this.destroyed = new CompositeHookCollection();
  this.followers={};
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
Follower.prototype.setCommander = function(fn){
  this.commander = fn;
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
Follower.prototype.pathOf = function(pathelem){
  return this.path?this.path.concat([pathelem]):([pathelem]);
};
Follower.prototype.childFollower = function(name){
  var f = this.followers[name];
  if(f){
    return f;
  }
  var t = this;
  f = new Follower(function(command,paramobj,statuscb){
    if(command.charAt(0)!=='/'){
      command = name+'/'+command;
    }
    t.do_command(command,paramobj,statuscb);
  });
  var fp = this.pathOf(name);
  f.path = fp;
  this.followers[name] = f;
  return f;
};
Follower.prototype.follow = function(name){
  if(typeof name === 'undefined'){
    return this;
  }
  if(this.followers[name]){
    return this.followers[name];
  }
  var f = this.childFollower(name);
  this.do_command('/follow',{path:f.path});
  return f;
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
			v = ('undefined' === typeof(v)) ? v : JSON.parse(v);
			ov = ('undefined' === typeof(ov)) ? ov : JSON.parse(ov);
			cb.call(this, v, ov);
		}
	}

	return this.listenToScalar(ctx, name, listeners);
}

Follower.prototype.follower = function(name){
  return this.followers[name];
};
Follower.prototype._subcommit = function(txnalias,txns){
  var txnps = txns[0],chldtxns=txns[1];
  //console.log(this.path?this.path.join('.'):'.','should commit',txnalias,txnps);
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
          }
          this.scalarChanged.fire(name,value,sv);
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
        //console.log('deleting',i);
        this.deleteScalar(i);
        this.deleteCollection(i);
      }
    }
    //now, re-awake all the needed followers
    for(var i in this.followers){
      //console.log('awaking follower',i);
      this.do_command('/follow',{path:this.followers[i].path});
    }
  }
  this.txnEnds.fire(txnalias);
  for(var i in chldtxns){
    var chldtxn=chldtxns[i];
    //console.log('child',i,chldtxn);
    this.childFollower(i)._subcommit(txnalias,chldtxn);
  }
  if(txnalias==='init'){
    for(var i in this.followers){
      if(!i in allinit){
        this.followers[i]._subcommit(txnalias,[]);
      }
    }
  }
};
Follower.prototype.commit = function(txns){
  //console.log('parent');
  for(var i in txns){
    var txn = txns[i];
    var txnalias = txn[0];
    //console.log(txnalias);
    this._subcommit(txn[0],txn[1]);
  }
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
  this.destroyed.fire();
  this.destroyed.destruct();
};

angular.
  module('HERS', []).
  constant('follower',new Follower()).
  constant('maxattemptspertimeout',5).
  constant('maxtimeout',3).
  value('sessionobj',{}).
  value('identity',{}).
  value('url',window.location.origin||window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port: '')).
  factory('transfer', function($http,$timeout,url,follower,identity,sessionobj,maxattemptspertimeout,maxtimeout){
    var transfer = function(command,queryobj,cb){
      command = command||'';
      var attempts = 0;
      if(sessionobj.name){
        queryobj[sessionobj.name]=sessionobj.value;
      }else{
        for(var i in identity){
          queryobj[i]=identity[i];
        }
      }
      queryobj.__timestamp__ = (new Date()).getTime();
      timeout = 1;
      var worker = (function(_cb){
        var cb = _cb;
        var _wrk = function(){
          //$http.get(url+command+querystring).
          if(command&&(command[0]!=='/')){
            command = '/'+command;
          }
          $http.get( url+command, {params:queryobj} ).
          success(function(data){
            if(data.errorcode){
              if(data.errorcode==='NO_SESSION'){
                sessionobj = {};
              }
              (typeof cb === 'function') && cb(data.errorcode,data.errorparams,data.errormessage);
              return;
            }
            if(identity.name && data.username!==identity.name){
              console.log('oopsadaisy',data.username,'!==',identity.name);
              if(sessionobj.name){
                delete queryobj[sessionobj.name];
              }
              for(var i in identity){
                queryobj[i] = identity[i];
              }
              sessionobj = {};
              //(typeof cb === 'function') && cb();
              _wrk();
              return;
            }
            if(data.session){
              for(var i in data.session){
                if(sessionobj.name!==i){
                  if(sessionobj.name){
                    sessionobj = {};
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
            }
            Follower.username=identity.name;
            var __cb=cb;
            $timeout(function(){
              data && data.data && follower.commit(data.data);
              (typeof __cb === 'function') && __cb(data.errorcode,data.errorparams,data.errormessage,data.results);
            },1);
          }).
          error(function(data,status,headers,config){
            console.log('error',status);
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
  factory('go',function($timeout,transfer,follower){
    return function(){
      var command_sent=false;
      var execute = [];
      var execcb = [];
      function do_execute(cb){
        command_sent=true;
        var ex = execute.splice(0);
        var excbs = execcb.splice(0);
        transfer('execute',{commands:ex},function(errcode,errparams,errmessage,results){
          ex = []; //simple relief
          if(excbs.length!==results.length){
            console.log('length mismatch, cbs length',excbs.length,'result length',results.length);
          }else{
            for(var i in excbs){
              excbs[i] && excbs[i].apply(null,results[i]);
            }
          }
          if(execute.length){
            do_execute(cb);
          }else{
            command_sent=false;
            cb && cb();
          }
        });
      };
      function do_command(command,paramobj,cb){
        execute.push([command,paramobj]);
        execcb.push(cb);
      };
      follower.setCommander(function(command,paramobj,statuscb){
        do_command(command,paramobj,statuscb);
      });
      var cb = function(){transfer('_',{},cb);};
      cb();
      var exec = function(){
        if(command_sent || (execute.length<1)){
          $timeout(exec,1);
        }else{
          do_execute(exec);
        }
      };
      exec();
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

