(function () {

var App = window.App = Ember.Application.create();

App.Segment = Ember.Object.extend({
  x: null,
  y: null,
  z: 0,

  equalTo: function(segment) {
    if (segment instanceof App.Segment) {
      return segment.get('x') === this.get('x') && segment.get('y') === this.get('y');
    }
    return segment.x === this.get('x') && segment.y === this.get('y');
  }
});

App.Snake = Ember.Object.extend({
  segments: null,
  secondObject: function() {
    this.get('segments')
  }.property('segments.@each')
});


App.SnakeController = Ember.ObjectController.extend({
  needs: ['treat', 'player'],

  intent: Ember.computed.alias('controllers.player.intent'),
  head: Ember.computed.alias('segments.firstObject'),

  // intentDidChange: function() {
  //   console.log(this.get('intent'))
  // }.observes('intent'),

  velocity: function() {
    segments = this.get('segments');
    return {
      x: segments[0].x - segments[1].x,
      y: segments[0].y - segments[1].y
    };
  }.property('head.x', 'head.y',
             'segments.secondObject.x', 'segments.secondObject.y'),

  getNextPosition: function(intent) {
    var velocity = this.get('velocity');
    if (intent && velocity.x !== -1 * intent.x &&
                  velocity.y !== -1 * intent.y) {
      velocity = intent;
    }
    return {
      x: this.get('head').x + velocity.x,
      y: this.get('head').y + velocity.y
    };
  },

  // nextPosition: function() {
  //   return this.getNextPosition(this.get('intent'));
  // }.property('intent', 'head.x', 'head.y', 'velocity'),

  step: function() {
    var self = this;
    var firstPosition = nextPosition = this.getNextPosition(this.get('intent'));

    var currPosition;
    this.get('segments').forEach(function(segment, i) {
      currPosition = { x: segment.get('x'), y: segment.get('y') };
      segment.set('x', nextPosition.x);
      segment.set('y', nextPosition.y);

      if (i > 1) {
        if (segment.equalTo(firstPosition)) {
          self.get('controllers.player').didCollide();
        }
      }

      nextPosition = currPosition;
    });

    if (this.get('segments.firstObject').equalTo(this.get('controllers.treat.content'))) {
      this.get('controllers.treat').move();
      this.set('controllers.player.points', this.get('controllers.player.points') + 1);
      console.log('points: %@'.fmt(this.get('controllers.player.points')));
    }

    this.set('intent', null);
  }
});

App.TreatController = Em.ObjectController.extend({
  content: null,
  init: function() {
    this._super();
    this.move();
  },
  randomPosition: function() {
    return {
      x: Math.floor(Math.random() * 40) - 20,
      y: Math.floor(Math.random() * 40) - 20
    };
  },
  move: function() {
    this.set('content', App.Segment.create(this.randomPosition()));
  }
});

App.PlayerController = Em.Controller.extend({
  needs: ['application', 'snake', 'treat'],
  points: 0,
  lives: 3,

  intent: null,

  autopilot: true,
  setIntentByAutopilot: function() {
    var self = this;

    if (!this.get('autopilot') || this.get('intent') !== null) {
      // console.log(this.get('intent'))
      return;
    }
    var distance = function(pos1, pos2) {
      return Math.sqrt(
        Math.pow(pos1.x - pos2.x, 2) +
        Math.pow(pos1.y - pos2.y, 2)
      );
    };

    var treatPos = this.get('controllers.treat.content'),
        headPos = this.get('controllers.snake.head');
    var keyIntents = this.get('keyIntents');
    for (var key in keyIntents) {
      var intent = keyIntents[key],
          nextPos = this.get('controllers.snake').getNextPosition(intent);

      if (distance(treatPos, nextPos) < distance(treatPos, headPos)) {
        return window.setTimeout(function(self) {
          return function() {
            self.set('intent', intent);
          };
        }(this), 20);
      }
    }
  }.observes('autopilot', 'intent'),

  didCollide: function() {
    this.set('lives', this.get('lives') - 1);
    if (this.get('lives') === 0) {
      return this.get('controllers.application').gameOver();
    }
    console.log('%@ lives left'.fmt(this.get('lives')));
  },

  init: function() {
    this.set('keyIntents', {
      'up': { x: 0, y: 1 },
      'down': { x: 0, y: -1 },
      'right': { x: 1, y: 0 },
      'left': { x: -1, y: 0 }
    });
    this.set('intent', { x: 1, y: 0 });
  }
});

App.WorldController = Em.Controller.extend({
  needs: ['player', 'snake', 'treat'],
  init: function() {
    this._super();

    var segments = [];
    for (var x = 7; x > -8; x--) {
      segments.pushObject(App.Segment.create({ x: x, y: 0 }));
    }
    this.set('controllers.snake.content', App.Snake.create({ segments: segments }));

    this.set('_intervalID', window.setInterval((function(self) {
      return function() {
        self.get('controllers.snake').step();
      };
    })(this), 100));
  }
});

App.ApplicationController = Em.Controller.extend({
  needs: ['world'],
  init: function() {
    var self = this;

    App.World3DRenderer.create({
      worldView: App.World3DView.create({
        context: this.get('controllers.world')
      })
    });
  },
  gameOver: function() {
    console.log('Game over! (Let\'s pretend)');
  }
});


// Views

App.Object3DView = Ember.Object.extend({
  scale: 35
});

App.Voxel3DView = App.Object3DView.extend({
  init: function() {
    this._super();
    this.positionDidChange();
  },
  mesh: function() {
    var scale = this.get('scale');
    var offset = -7;
    var geometry = new THREE.CubeGeometry( scale+offset, scale+offset, scale+offset );
    var material = new THREE.MeshLambertMaterial( { color: this.get('color'), transparent: true } );
    material.opacity = 0.75;
    return new THREE.Mesh( geometry, material );
  }.property(),
  render: function(scene) {
    scene.add(this.get('mesh'));
    return this;
  },
  positionDidChange: function() {
    var scale = this.get('scale');
    this.get('mesh').position.x = this.get('context.x') * scale;
    this.get('mesh').position.y = this.get('context.y') * scale;
    this.get('mesh').position.z = this.get('context.z') * scale;
  }.observes('context.x', 'context.y')
});

App.Snake3DView = App.Object3DView.extend({
  render: function(scene) {
    var self = this;
    var childViews = [];
    this.get('context.segments').forEach(function(segment) {
      childViews.pushObject(App.Voxel3DView.create({
        color: 0xdd2222,
        context: segment
      }).render(scene));
    });
    this.set('childViews', childViews);
    return this;
  }
})

App.Player3DView = App.Object3DView.extend({
  camera: function() {
    return new THREE.PerspectiveCamera(
      75,  // VIEW_ANGLE
      window.innerWidth / window.innerHeight,  // ASPECT = WIDTH / HEIGHT
      1,  // NEAR
      10000  // FAR);
    )
  }.property(),
  render: function(scene) {
    var camera = this.get('camera');
    scene.add(camera);
  
    var coords = {};
    coords.x = 0;
    coords.y = 0;
    coords.z = 1200;
                                           
    camera.rotation.y = 45;
    camera.position.x = coords.x;
    camera.position.y = coords.y;
    camera.position.z = coords.z;
    // Always look at the origin
    camera.lookAt(new THREE.Vector3(coords.x,coords.y,coords.z));
    return this;
  },

  keyboardControlsCamera: false,

  keyDidChange: function() {
    // TODO Use a StateManager for this
    if (this.get('keyboardControlsCamera')) {
      var camera = this.get('camera');
      // TODO
    }
    else {  // keyboard controls snake
      var key = this.get('key');
      this.set('context.intent', this.get('context.keyIntents')[key]);
    }
  }.observes('key'),

  init: function() {
    this._super();
    document.addEventListener('mousemove', function(e) {
      console.log(e.movementX, e.movementY)
    });
  }
});

App.World3DView = App.Object3DView.extend({
  scene: function() {
    var scene = new THREE.Scene();
    // scene.fog = new THREE.Fog(this.get('backgroundColor'), 970);
    return scene;
  }.property(),

  init: function() {
    this._super();
    this.set('childViews', {});

    var scene = this.get('scene');

    this.set('childViews.player', App.Player3DView.create({
      context: this.get('context.controllers.player')
    }).render(scene));

    var pointLight = new THREE.PointLight(0xFFFFFF);
    pointLight.position.x = 0;
    pointLight.position.y = 0;
    pointLight.position.z = 500;
    scene.add(pointLight);

    this.set('childViews.snake', App.Snake3DView.create({
      context: this.get('context.controllers.snake')
    }).render(scene));

    this.set('childViews.treat', App.Voxel3DView.create({
      color: 0x44dd44,
      context: this.get('context.controllers.treat')
    }).render(scene));
  },
  // treatDidChange: function() {
  //   this.get('childViews.player.camera').lookAt(this.get('childViews.treat.mesh').position)
  // }.observes('context.controllers.treat.content.x', 'context.controllers.treat.y')
})

App.World3DRenderer = App.Object3DView.extend({
  backgroundColor: 0x10104a,
  renderer: function() {
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor(this.get('backgroundColor'), 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    return renderer;
  }.property(),

  animate: function(timestamp) {
    requestAnimationFrame((function(self) {
      return function() {
        self.animate();
      };
    })(this));

    var self = this;
    // TODO change this to track states
    ['up', 'down', 'left', 'right'].forEach(function(alias) {
      if (self.get('keyboard').pressed(alias)) {
        self.set('worldView.childViews.player.key', alias);
      }
    });
var camera = this.get('worldView.childViews.player.camera');

    this.get('renderer').render(this.get('worldView.scene'), this.get('worldView.childViews.player.camera'));
  },

  init: function() {
    this._super();
    // this.set('worldView', App.World3DView.create());
    this.set('keyboard', new THREEx.KeyboardState());
    this.animate();
  }
});


})(this);
