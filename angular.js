
angular.
  module('HERS', ['btford.socket-io']).
  value('sessionobj',{}).
  value('identity',{}).
  factory('Follower',['identity',function(identity){
    return (function(exec,identity){
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
      return identity.name;
    };

    Follower.prototype.realmname = function () {
      return identity.realmname;
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
    })(hersexecutable,identity);
  }]).
  factory('follower',['Follower',function(Follower){
    return new Follower();
  }]).
  factory('makeupQuery',['identity','sessionobj',function(identity,sessionobj){
    return function(command,queryobj){
      var retcommand = command||'_', retobj = queryobj||{};
      if(sessionobj.name){
        retobj[sessionobj.name] = sessionobj.value;
      }
      for(var i in identity){
        retobj[i] = identity[i];
      }
      retobj.__timestamp__ = (new Date()).getTime();
      if(retcommand.charAt(0)!=='/'){
        retcommand = '/'+retcommand;
      }
      retcommand = url+retcommand;
      return [retcommand,{params:retobj}];
    };
  }]).
  value('url',window.location.origin||window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port: '')).
  factory('SocketIOManager',['socketFactory','sessionobj','identity','follower',function(socketFactory,sessionobj,identity,follower){
    function SM(){
      this.socket = null;
      this.ready = false;
      this.sessionname = null;
      this.connected = new hersexecutable.HookCollection();
      this.disconnected = new hersexecutable.HookCollection();
    }
    SM.prototype.destroy = function(){
      this.disconnected.destruct();
      this.disconnected = null;
      this.connected.destruct();
      this.connected = null;
      this.username = null;
      this.ready = null;
      if(this.socket){
        this.socket.disconnect(true);
      }
      this.socket = null;
    };
    SM.prototype.init = function(){
      if(sessionobj.name!==this.sessionname){
        if(this.socket){
          this.ready = false;
          this.socket.disconnect();
          return;
        }
      }
      if(this.socket){
        return;
      }
      this.sessionname = sessionobj.name;
      this.socket = socketFactory({ioSocket: io.connect('/?'+sessionobj.name+'='+sessionobj.value+'&username='+identity.name,{
        'reconnection':false,
        'force new connection':true
      })});
      //console.log('time for socket.io',sio,data);
      this.socket.on('socket:error', this.onError.bind(this));
      this.socket.on('disconnect', this.onDisconnected.bind(this));
      this.socket.on('connect', this.onConnected.bind(this));
      this.socket.on('_',follower.commit.bind(follower));
    };
    SM.prototype.onConnected = function(){
      this.connected.fire();
      this.ready = true;
    };
    SM.prototype.onDisconnected = function(){
      this.socket = null;
      this.ready = false;
      this.sessionname = null;
      this.disconnected.fire();
    };
    SM.prototype.onError = function(reason){
    };
    return new SM();
  }]).
  factory('TransferManager',['$http','$timeout','identity','sessionobj','SocketIOManager','follower',function($http,$timeout,identity,sessionobj,SocketIOManager,follower){
    function TM(){
      this.maxattemptspertimeout = 5;
      this.attempts = 0;
      this.timeout = 1;
      this.maxtimeout = 3;
      this.sockDisconnectionWaiter = SocketIOManager.disconnected.attach(this.go.bind(this));
    }
    TM.prototype.destroy = function(){
      SocketIOManager.disconnected.detach(this.sockDisconnectionWaiter);
      this.sockDisconnectionWaiter = null;
    };
    TM.prototype.send = function(command,queryobj,cb,withreconnection){
      $http.get(command,queryobj).success(this.onSuccess.bind(this,cb)).error(this.onError.bind(this,withreconnection));
    };
    TM.prototype.go = function(){
      if(SocketIOManager.ready){
        return;
      }
      if(SocketIOManager.socket){
        $timeout(this.go.bind(this),1000);
        return;
      }
      this.send('_',{},this.go.bind(this),true);
    };
    TM.prototype.onSuccess = function(cb,data){
      if(identity.name && data.username!==identity.name){
        console.log('oopsadaisy',data.username,'!==',identity.name);
        follower._purge();
        for(var i in sessionobj){
          delete sessionobj[i];
        }
        for(var i in identity){
          delete identity[i];
        }
      }

      identity.name = data.username;
      identity.realm = data.realmname;
      identity.roles = data.roles ? data.roles.split(',') : [];

      if(data.session){
        for(var i in data.session){
          if(sessionobj.name!==i){
            if(sessionobj.name){
              for(var i in sessionobj){
                delete sessionobj[i];
              }
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
        SocketIOManager.init();
        data && data.data && follower.commit(data.data);
        (typeof cb === 'function') && cb(data.errorcode,data.errorparams,data.errormessage,data.results);
      }else{
        $timeout(function(){
          data && data.data && follower.commit(data.data);
          (typeof __cb === 'function') && __cb(data.errorcode,data.errorparams,data.errormessage,data.results);
        },10000);
      }
    };
    TM.prototype.onError = function(withreconnection,data,stts,headers,config){
      console.log('error',stts);
      if(stts==401){
        delete identity.name;
        delete identity.realm;
        return;
      }
      if(stts==0){
        if(withreconnection){
          this.attempts++;
          if(this.attempts>this.maxattemptspertimeout){
            this.attempts=0;
            if(this.timeout<this.maxtimeout){
              this.timeout++;
            }
          }
          $timeout(this.go.bind(this),this.timeout*1000);
        }
      }
    };
    return new TM();
  }]).
  factory('commander',['SocketIOManager','TransferManager',function(SocketIOManager,TransferManager){
    function C(){
      this.sent = false;
      this.execute = [];
      this.execcb = [];
      if(SocketIOManager.ready){
        this.listenToSockIO();
      }else{
        SocketIOManager.connected.attach(this.listenToSockIO.bind(this));
      }
    }
    C.prototype.listenToSockIO = function(){
      SocketIOManager.socket.on('=',this.do_results.bind(this));
    };
    C.prototype.do_results = function(results){
      if(!results){return;}
      while(results.length){  
        var excb = this.execcb.shift();
        //console.log(execute[0],execute[1],'=>',results[0]);
        var res = results.shift();
        this.execute.shift();
        this.execute.shift();
        //excb && excb.apply(null,res);
        if(hersexecutable.isA(excb)){
          hersexecutable.apply(excb,res);
        }
      }
      if(this.execute.length && (this.execute.length == this.execcb.length*2)){ //new pack
        this.do_execute();
      }
      //console.log('execcb left',execute);
    };
    C.prototype.do_execute = function(){
      if(SocketIOManager.ready){
        SocketIOManager.socket.emit('!',this.execute.slice());
        return;
      }
      TransferManager.send('!',{commands:JSON.stringify(this.execute.slice())},this.onResults.bind(this));
    };
    C.prototype.onResults = function(errcode,errparams,errmessage,results){
      if(errcode==='NO_SESSION'){
        for(var i in sessionobj){
          delete sessionobj[i];
        }
        this.do_execute();
        return;
      }
      this.do_results(results);
    };
    C.prototype.do_command = function(command,paramobj,cb){
      var shouldfire = (this.execute.length===0);
      this.execute.push(command,paramobj);
      this.execcb.push(cb);
      //console.log(command,execute.length,execcb.length);
      if(shouldfire){
        this.do_execute();
      }
    };
    var c = new C();
    return c.do_command.bind(c);
  }]).
  factory('go',function(follower,TransferManager,commander){
    return function(){
      follower.setCommander(commander);
      TransferManager.go();
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
