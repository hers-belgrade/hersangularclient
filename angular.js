var Follower = (function(exec){
function ListenerDestroyer(hook,cb){
  this.hook = hook;
  this.hookindex = hook.attach(cb);
}
ListenerDestroyer.prototype.destroy = function(){
  this.hook.detach(this.hookindex);
  this.hook = null;
  this.hookindex = null;
}
function CompositeHookCollection(){
  this.hook = new exec.HookCollection();
  this.subhooks = {};
};
CompositeHookCollection.prototype.listen = function(cb){
  return new ListenerDestroyer(this.hook,cb);
};
CompositeHookCollection.prototype.sublisten = function(name,cb){
  var sh = this.subhooks[name];
  if(!sh){
    sh = new exec.HookCollection();
    this.subhooks[name] = sh;
  }
  return new ListenerDestroyer(sh,cb);
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
};
CompositeHookCollection.prototype.destruct = function(){
  this.hook.destruct();
  for(var i in this.subhooks){
    this.subhooks[i].destruct();
    delete this.subhooks[i];
  }
  this.subhooks = null;
  this.hook = null;
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
      exec.applyNext([exec,exec.call],[la,i]);
      //exec.call(la,i);
    }
  }
  var ls = listenerpack.setter;
  if(ls){
    sl.s = this.follower.scalarChanged.listen(ls);
    for(var i in ss){
      exec.applyNext([exec,exec.apply],[ls,[i,ss[i]]]);
      //exec.apply(ls,[i,ss[i]]);
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
      exec.callNext([exec,exec.run],la);
      //exec.run(la);
    }
  }
  var ls = listenerpack.setter;
  if(ls){
    sl.s = this.follower.scalarChanged.sublisten(scalarname,ls);
    if(typeof sv !== 'undefined'){
      exec.applyNext([exec,exec.call],[ls,sv]);
      //exec.call(ls,sv);
    }
  }
  var ld = listenerpack.deactivator;
  if(ld){
    sl.d = this.follower.scalarRemoved.sublisten(scalarname,ld);
    if(typeof sv === 'undefined'){
      exec.callNext([exec,exec.run],ld);
      //exec.run(ld);
    }
  }
};
CompositeListener.prototype.listenToCollections = function(listenerpack){
  var sl = this._getClearListener('/collections/');
  var la = listenerpack.activator;
  if(la){
    sl.a = this.follower.newCollection.listen(la);
    for(var i in this.follower.collections){
      exec.applyNext([exec,exec.call],[la,i]);
      //exec.call(la,i);
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
  var collectiondefined = typeof this.follower.collections[collectionname] !== 'undefined';
  if(la){
    sl.a = this.follower.newCollection.sublisten(collectionname,la);
    if(collectiondefined){
      exec.callNext([exec,exec.run],la);
      //exec.run(la);
    }
  }
  var ld = listenerpack.deactivator;
  if(ld){
    sl.d = this.follower.collectionRemoved.sublisten(collectionname,ld);
    if(!collectiondefined){
      exec.callNext([exec,exec.run],ld);
      //exec.run(ld);
    }
  }
};
function destroyListenerChild(l,li){
  for(var i in l){
    l[i].destroy();
    l[i] = null;
  }
  delete this[li];
}
CompositeListener.prototype.destroy = function(){
  this.follower = null;
  exec.traverse(this.listeners,[this.listeners,destroyListenerChild]);
  this.listeners = null;
};

function Follower(commander){
  this.commander = null;
  this.scalars = {};
  this.collections = {};
  this.newScalar = new CompositeHookCollection();
  this.scalarChanged = new CompositeHookCollection();
  this.scalarRemoved = new CompositeHookCollection();
  this.newCollection = new CompositeHookCollection();
  this.collectionRemoved = new CompositeHookCollection();
  this.onReset = new CompositeHookCollection();
  this.destroyed = new CompositeHookCollection();
  this.followers={};
  if(commander){
    this.setCommander(commander);
  }
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
Follower.prototype.do_command = function(command,paramobj,cb){
  exec.apply(this.commander,[command,paramobj,cb]);
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
  if(exec.isA(fn)){
    this.commander = fn;
  }
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
  var p = this.path || [];
  return typeof pathelem === 'undefined' ? p : p.concat([pathelem]);
};
function sendCommand(name,command,paramobj,statuscb){
  var fc = command.charAt(0);
  if(fc!=='/' && fc!==':'){
    command = name+'/'+command;
  }
  this.do_command(command,paramobj,statuscb);
}
Follower.prototype.childFollower = function(name){
  var f = this.followers[name];
  if(f){
    return f;
  }
  var t = this;
  f = new Follower([this,sendCommand,[name]]);
  var fp = this.pathOf(name);
  f.path = fp;
  this.followers[name] = f;
  f.destroyed.listen([this,this.onChildDestroyed,[name]]);
  return f;
};
Follower.prototype.onChildDestroyed = function(name){
  delete this.followers[name];
};
Follower.prototype.follow = function(name){
  if(typeof name === 'undefined'){
    return this;
  }
  if(typeof name === 'string' && !name.length){
    return this;
  }
  if(this.followers[name]){
    return this.followers[name];
  }
  var f = this.childFollower(name);
  //this.do_command(':follow',f.path);
  return f;
};
Follower.prototype.unfollow = function(name){
  //this.do_command(':unfollow',{path:this.pathOf(name)});
};

Follower.prototype.listenToCollections = function(ctx,listeners){
  var ret = new CompositeListener(this);
  ret.listenToCollections(listeners);
  return ret;
};
function isNullElement(el){
  if(el===null){
    return true;
  }
}
function multiTrigger(cb,name,val){
  if(typeof val === 'undefined'){
    this[name] = null;
    return;
  }
  this[name] = val;
  if(exec.traverseConditionally(this,isNullElement)){
    return;
  }
  exec.call(cb,this);
}
Follower.prototype.listenToMultiScalars = function(ctx,scalarnamearry,cb){
  var ret = new CompositeListener(this),combo = {};
  for(var i in scalarnamearry){
    combo[scalarnamearry[i]] = null;
  }
  for(var i in scalarnamearry){
    ret.addScalar(scalarnamearry[i],{setter:[combo,multiTrigger,[cb,scalarnamearry[i]]]});
  }
  return ret;

};
Follower.prototype.listenToScalars = function(ctx,listeners){
  var ret = new CompositeListener(this);
  ret.listenToScalars(listeners);
  return ret;
};
Follower.prototype.listenToCollection = function(ctx,name,listeners){
  var ret = new CompositeListener(this);
  ret.addCollection(name,listeners);
  return ret;
};
Follower.prototype.listenToScalar = function(ctx,name,listeners){
  var ret = new CompositeListener(this);
  ret.addScalar(name,listeners);
  return ret;
};
function jsonProcess(val,oldval){
  val = ('undefined' !== typeof(val) && val.length) ? JSON.parse(val) : undefined;
  oldval = ('undefined' !== typeof(oldval) && oldval.length) ? JSON.parse(oldval) : undefined;
  exec.apply(this,[val,oldval]);
}
Follower.prototype.listenToJSONScalar = function (ctx, name, listeners) {
	if (listeners.setter) {
		var cb = listeners.setter;
		listeners.setter = [cb,jsonProcess];
	}
	return this.listenToScalar(ctx, name, listeners);
};
Follower.prototype.follower = function(name){
  return this.followers[name];
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
};

Follower.prototype.disconnect = function(){
  this.socketio = null;
};
Follower.prototype.clear = function() {
  for(var i in this.followers){
    this.followers[i].clear();
  }
  for(var i in this.scalars){
    this.deleteScalar(i);
  }
  for (var i in this.collections) {
    this.deleteCollection(i);
  }
};
Follower.prototype.reset = function(){
  for(var i in this.followers){
    this.followers[i].reset();
    //this.followers[i].destroy();
    //console.log(this.path,'destroying',i);
    //delete this.followers[i];
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
  console.log(JSON.stringify(primitive[0]),JSON.stringify(primitive[1]));
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
  this.newScalar.destruct();
  this.scalarChanged.destruct();
  this.scalarRemoved.destruct();
  this.newCollection.destruct();
  this.collectionRemoved.destruct();
  this.onReset.destruct();
  this.destroyed.fire();
  this.destroyed.destruct();
};
return Follower;
})(hersexecutable);

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
            var __cb=cb;
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
                  (typeof __cb === 'function') && __cb();
                });
                sio.on('disconnect', function(){
                  delete follower.socketio;
                  delete follower.anonymousattempts;
                  (typeof __cb === 'function') && __cb();
                });
                sio.on('connect', function(){
                  //console.log('socket.io connected');
                  delete follower.waitingforsockio;
                  follower.socketio = sio;
                });
                sio.on('_',function(data){
                  follower.commit(data);
                  //follower.commitOne(data);
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
          //excb && excb.apply(null,res);
          if(hersexecutable.isA(excb)){
            hersexecutable.apply(excb,res);
          }
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
