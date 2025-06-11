class LevelOne extends Phaser.Scene {
  constructor(key = 'LevelOne') {
    super(key);
    this.mapKey = 'levelOne';
    this.musicKey = 'musicLevelone';
    this.isDead = false;
  }

  preload() {
    this.load.audio(this.musicKey, `assets/audio/${this.musicKey}.mp3`);
    this.load.tilemapTiledJSON(this.mapKey, `assets/maps/${this.mapKey}.tmj`);
    this.load.image('world_tileset', 'assets/tilesets/world_tileset.png');
    this.load.image('platforms', 'assets/tilesets/platforms.png');
    this.load.spritesheet('knight', 'assets/sprites/knight.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('coin', 'assets/sprites/coin.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('slime_green', 'assets/sprites/slime_green.png', { frameWidth: 24, frameHeight: 24 });
    this.load.spritesheet('slime_purple', 'assets/sprites/slime_purple.png', { frameWidth: 24, frameHeight: 24 });

    this.load.audio('coinSound', 'assets/audio/coin.wav');

    this.textures.get('world_tileset')?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get('platforms')?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  create() {
    const map = this.make.tilemap({ key: this.mapKey });
    const worldTiles = map.addTilesetImage('world_tileset', 'world_tileset');
    const platformTiles = map.addTilesetImage('platforms', 'platforms');

    map.createLayer('Background', worldTiles);
    map.createLayer('World', worldTiles);

    const walkableLayer = map.createLayer('Walkable', [worldTiles, platformTiles]);
    this.walkableLayer = walkableLayer;
    walkableLayer.setCollisionByExclusion([-1]);

    this.player = this.physics.add.sprite(100, 100, 'knight');
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, walkableLayer);
    this.player.setOrigin(0, 1);
    this.player.body.setSize(20, 24);
    this.player.body.setOffset(6, 4);

    this.cameras.main.startFollow(this.player);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      let currentZoom = this.cameras.main.zoom - deltaY * 0.001;
      this.cameras.main.setZoom(Phaser.Math.Clamp(currentZoom, 0.5, 2.5));
    });

    if (this.music) this.music.stop();
    this.music = this.sound.add(this.musicKey, { loop: true, volume: 0.5 });
    this.music.play();

    this.createAnimations();

    this.cursors = this.input.keyboard.createCursorKeys();

    this.coins = this.physics.add.group();
    const coinsObjects = map.getObjectLayer('Coins')?.objects || [];
    coinsObjects.forEach(obj => {
      const coin = this.coins.create(obj.x, obj.y - obj.height, 'coin');
      coin.play('spin');
      coin.body.setAllowGravity(false);
      coin.setOrigin(0, 0);
    });

    this.totalCoins = coinsObjects.length;
    this.collected = 0;

    this.physics.add.overlap(this.player, this.coins, (player, coin) => {
      this.sound.play('coinSound');
      coin.destroy();
      this.collected++;
      if (this.collected === this.totalCoins) {
        this.music.stop();

        let next = 'WinSceneOne';
        if (this.scene.key === 'LevelTwo') next = 'WinSceneTwo';
        if (this.scene.key === 'LevelThree') next = 'WinSceneThree';

        this.scene.start(next);
      }
    });

    this.enemies = this.physics.add.group();
    const enemiesObjects = map.getObjectLayer('Enemies')?.objects || [];
    enemiesObjects.forEach(obj => {
      const type = obj.properties?.find(p => p.name === 'type')?.value || 'slime_green';
      const slime = this.enemies.create(obj.x, obj.y - 24, type);
      slime.setVelocityX(-30).setBounceX(1).setCollideWorldBounds(true);
      slime.anims.play(`${type}_walk`);
      slime.body.setSize(20, 20);
    });

    this.physics.add.collider(this.enemies, walkableLayer);
    this.physics.add.collider(this.player, this.enemies, (player, enemy) => {
      if (player.body.velocity.y > 0 && player.y < enemy.y) {
        enemy.destroy();
        player.setVelocityY(-200);
      } else {
        this.handlePlayerDeath();
      }
    });

    this.isDead = false;
  }

  createAnimations() {
    this.anims.create({ key: 'idle', frames: this.anims.generateFrameNumbers('knight', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'run', frames: this.anims.generateFrameNumbers('knight', { start: 4, end: 19 }), frameRate: 12, repeat: -1 });
    this.anims.create({ key: 'roll', frames: this.anims.generateFrameNumbers('knight', { start: 20, end: 27 }), frameRate: 14, repeat: 0 });
    this.anims.create({ key: 'hit', frames: this.anims.generateFrameNumbers('knight', { start: 28, end: 31 }), frameRate: 8, repeat: 0 });
    this.anims.create({ key: 'death', frames: this.anims.generateFrameNumbers('knight', { start: 32, end: 35 }), frameRate: 6, repeat: 0 });
    this.anims.create({ key: 'spin', frames: this.anims.generateFrameNumbers('coin', { start: 0, end: 11 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'slime_green_walk', frames: this.anims.generateFrameNumbers('slime_green', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'slime_purple_walk', frames: this.anims.generateFrameNumbers('slime_purple', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
  }

  update() {
    if (this.isDead) return;

    const speed = 120;
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-speed);
      this.player.flipX = true;
      this.player.anims.play('run', true);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(speed);
      this.player.flipX = false;
      this.player.anims.play('run', true);
    } else {
      this.player.setVelocityX(0);
      this.player.anims.play('idle', true);
    }

    if (this.cursors.up.isDown && this.player.body.blocked.down) {
      this.player.setVelocityY(-275);
    }

    if (this.player.y > this.physics.world.bounds.height) {
      this.handlePlayerDeath();
    }

    this.enemies.children.iterate(enemy => {
      if (!enemy.body) return;
      const direction = enemy.body.velocity.x < 0 ? -1 : 1;
      const offsetX = direction * enemy.body.width * 0.5;
      const checkX = enemy.x + offsetX;
      const checkY = enemy.y + enemy.body.height / 2 + 2;
      const tile = this.walkableLayer.getTileAtWorldXY(checkX, checkY);
      const hasGround = tile && tile.collides;
      if (!hasGround) {
        enemy.setVelocityX(-enemy.body.velocity.x);
        enemy.flipX = !enemy.flipX;
      }
    });
  }

  handlePlayerDeath() {
    if (this.isDead) return;
    this.isDead = true;
    this.player.setVelocity(0, 0);
    this.player.anims.play('death');
    this.player.body.enable = false;
    this.player.once('animationcomplete-death', () => {
      this.scene.start('LoseScene', { restartScene: this.scene.key });
    });
  }
}

// ---------------------------------------------

class LevelTwo extends LevelOne {
  constructor() {
    super('LevelTwo');
    this.mapKey = 'levelTwo';
    this.musicKey = 'musicLeveltwo';
  }
}

// ---------------------------------------------

class LevelThree extends LevelOne {
  constructor() {
    super('LevelThree');
    this.mapKey = 'levelThree';
    this.musicKey = 'musicLevelthree';
  }
}

// ---------------------------------------------

class WinSceneOne extends Phaser.Scene {
  constructor() {
    super('WinSceneOne');
  }

  create() {
    this.add.text(100, 100, 'Level 1 Complete!', { fontSize: '32px', fill: '#fff' });
    this.add.text(100, 160, 'Press SPACE to go to Level 2', { fontSize: '20px', fill: '#0f0' });
    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('LevelTwo');
    });
  }
}

class WinSceneTwo extends Phaser.Scene {
  constructor() {
    super('WinSceneTwo');
  }

  create() {
    this.add.text(100, 100, 'Level 2 Complete!', { fontSize: '32px', fill: '#fff' });
    this.add.text(100, 160, 'Press SPACE to go to Level 3', { fontSize: '20px', fill: '#0f0' });
    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('LevelThree');
    });
  }
}

class WinSceneThree extends Phaser.Scene {
  constructor() {
    super('WinSceneThree');
  }

  create() {
    this.add.text(100, 100, 'Level 3 Complete!', { fontSize: '32px', fill: '#fff' });
    this.add.text(100, 160, 'Press SPACE to restart from Level 1', { fontSize: '20px', fill: '#0f0' });
    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('LevelOne');
    });
  }
}

// ---------------------------------------------

class LoseScene extends Phaser.Scene {
  constructor() {
    super('LoseScene');
  }

  create(data) {
    this.add.text(100, 100, 'You Lose!', { fontSize: '32px', fill: '#fff' });
    this.add.text(100, 160, 'Press SPACE to retry', { fontSize: '20px', fill: '#f00' });

    const restartScene = data?.restartScene || 'LevelOne';
    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start(restartScene);
    });
  }
}

// ---------------------------------------------

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 500 },
      debug: true
    }
  },
  scene: [
    LevelOne, LevelTwo, LevelThree,
    WinSceneOne, WinSceneTwo, WinSceneThree,
    LoseScene
  ]
};

const game = new Phaser.Game(config);
