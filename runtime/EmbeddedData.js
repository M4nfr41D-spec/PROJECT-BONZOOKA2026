// Embedded data fallback for file:// / external-file mobile previews
export const EmbeddedData = {
  "acts": {
    "tiers": [
      {
        "id": "tier1",
        "name": "Asteroid Belt",
        "description": "Navigate the treacherous asteroid fields",
        "biome": "asteroid",
        "zoneStart": 1,
        "zoneEnd": 100,
        "bossEvery": 5,
        "generation": {
          "width": [
            1800,
            2500
          ],
          "height": [
            1800,
            2500
          ],
          "enemyDensity": 0.0004,
          "eliteDensity": 0.00008,
          "obstacleDensity": 0.00025
        },
        "enemies": {
          "pool": [
            "grunt",
            "scout",
            "turret"
          ],
          "elitePool": [
            "commander",
            "shielder"
          ],
          "bossPool": [
            "sentinel"
          ]
        },
        "boss": {
          "type": "sentinel",
          "arenaWidth": 1200,
          "arenaHeight": 1000
        },
        "parallax": {
          "bgColor": "#080810",
          "nebula": {
            "enabled": true,
            "count": 5,
            "color": "#221144"
          }
        },
        "hazards": [],
        "enemyHPMult": 1,
        "enemyDmgMult": 1,
        "lootBonus": 1,
        "xpMult": 1
      },
      {
        "id": "tier2",
        "name": "Nebula Depths",
        "description": "Descend into the toxic nebula clouds",
        "biome": "nebula",
        "zoneStart": 101,
        "zoneEnd": 250,
        "bossEvery": 5,
        "generation": {
          "width": [
            2000,
            3000
          ],
          "height": [
            2000,
            3000
          ],
          "enemyDensity": 0.0005,
          "eliteDensity": 0.0001,
          "obstacleDensity": 0.0002
        },
        "enemies": {
          "pool": [
            "grunt",
            "scout",
            "diver",
            "bomber",
            "cloaker"
          ],
          "elitePool": [
            "commander",
            "sniper",
            "shielder"
          ],
          "bossPool": [
            "sentinel",
            "collector"
          ]
        },
        "boss": {
          "type": "collector",
          "arenaWidth": 1400,
          "arenaHeight": 1100
        },
        "parallax": {
          "bgColor": "#100818",
          "nebula": {
            "enabled": true,
            "count": 8,
            "color": "#442266"
          }
        },
        "hazards": [
          "toxic_clouds"
        ],
        "enemyHPMult": 1.2,
        "enemyDmgMult": 1.15,
        "lootBonus": 1.2,
        "xpMult": 1.3
      },
      {
        "id": "tier3",
        "name": "The Void",
        "description": "Endless darkness -- no turning back",
        "biome": "void",
        "zoneStart": 251,
        "zoneEnd": null,
        "bossEvery": 5,
        "generation": {
          "width": [
            2500,
            3500
          ],
          "height": [
            2500,
            3500
          ],
          "enemyDensity": 0.0006,
          "eliteDensity": 0.00012,
          "obstacleDensity": 0.00015
        },
        "enemies": {
          "pool": [
            "scout",
            "diver",
            "tank",
            "bomber",
            "cloaker",
            "summoner"
          ],
          "elitePool": [
            "commander",
            "sniper",
            "berserker",
            "shielder"
          ],
          "bossPool": [
            "collector",
            "harbinger"
          ]
        },
        "boss": {
          "type": "harbinger",
          "arenaWidth": 1600,
          "arenaHeight": 1300
        },
        "parallax": {
          "bgColor": "#050508",
          "nebula": {
            "enabled": true,
            "count": 3,
            "color": "#220033"
          }
        },
        "hazards": [
          "void_rifts"
        ],
        "enemyHPMult": 1.4,
        "enemyDmgMult": 1.3,
        "lootBonus": 1.4,
        "xpMult": 1.5
      },
      {
        "id": "tier4",
        "name": "Derelict Fleet",
        "description": "Shattered warships drifting in dead space",
        "biome": "derelict",
        "zoneStart": 401,
        "zoneEnd": 600,
        "bossEvery": 5,
        "generation": {
          "width": [
            2800,
            3800
          ],
          "height": [
            2800,
            3800
          ],
          "enemyDensity": 0.00065,
          "eliteDensity": 0.00014,
          "obstacleDensity": 0.00028
        },
        "enemies": {
          "pool": [
            "diver",
            "tank",
            "bomber",
            "cloaker",
            "summoner",
            "turret"
          ],
          "elitePool": [
            "sniper",
            "berserker",
            "shielder"
          ],
          "bossPool": [
            "sentinel",
            "collector",
            "harbinger"
          ]
        },
        "boss": {
          "type": "harbinger",
          "arenaWidth": 1600,
          "arenaHeight": 1300
        },
        "parallax": {
          "bgColor": "#0a0a12",
          "nebula": {
            "enabled": true,
            "count": 4,
            "color": "#332211"
          }
        },
        "hazards": [
          "radiation_pockets",
          "debris_storm"
        ],
        "lootBonus": 1.6,
        "xpMult": 1.8,
        "enemyHPMult": 1.6,
        "enemyDmgMult": 1.5
      },
      {
        "id": "tier5",
        "name": "Black Hole Approach",
        "description": "Gravity warps space itself near the event horizon",
        "biome": "blackhole",
        "zoneStart": 601,
        "zoneEnd": null,
        "bossEvery": 5,
        "generation": {
          "width": [
            3000,
            4200
          ],
          "height": [
            3000,
            4200
          ],
          "enemyDensity": 0.0007,
          "eliteDensity": 0.00016,
          "obstacleDensity": 0.0002
        },
        "enemies": {
          "pool": [
            "tank",
            "bomber",
            "cloaker",
            "summoner",
            "turret",
            "shielder"
          ],
          "elitePool": [
            "sniper",
            "berserker",
            "shielder",
            "commander"
          ],
          "bossPool": [
            "collector",
            "harbinger"
          ]
        },
        "boss": {
          "type": "harbinger",
          "arenaWidth": 1800,
          "arenaHeight": 1500
        },
        "parallax": {
          "bgColor": "#020208",
          "nebula": {
            "enabled": true,
            "count": 2,
            "color": "#110022"
          }
        },
        "hazards": [
          "gravity_wells",
          "void_rifts"
        ],
        "lootBonus": 2,
        "xpMult": 2.5,
        "enemyHPMult": 2,
        "enemyDmgMult": 1.8
      }
    ],
    "portals": [
      {
        "id": "portal1",
        "name": "Asteroid Gate",
        "startZone": 1,
        "unlocked": true,
        "tierId": "tier1",
        "icon": "🪨"
      },
      {
        "id": "portal2",
        "name": "Nebula Rift",
        "startZone": 101,
        "unlocked": true,
        "tierId": "tier2",
        "icon": "🌌"
      },
      {
        "id": "portal3",
        "name": "Void Breach",
        "startZone": 251,
        "unlocked": true,
        "tierId": "tier3",
        "icon": "🕳️"
      },
      {
        "id": "portal4",
        "name": "Fleet Wreckage",
        "tierId": "tier4",
        "startZone": 401,
        "unlocked": true,
        "icon": "🛸"
      },
      {
        "id": "portal5",
        "name": "Event Horizon",
        "tierId": "tier5",
        "startZone": 601,
        "unlocked": true,
        "icon": "🌀"
      }
    ],
    "_legacy_act1": {
      "name": "Asteroid Belt",
      "zones": 4,
      "unlocked": true,
      "generation": {
        "width": [
          1800,
          2500
        ],
        "height": [
          1800,
          2500
        ],
        "enemyDensity": 0.0004,
        "eliteDensity": 0.00008,
        "obstacleDensity": 0.00025
      },
      "enemies": {
        "pool": [
          "grunt",
          "scout"
        ],
        "elitePool": [
          "commander"
        ]
      },
      "boss": {
        "type": "sentinel",
        "arenaWidth": 1200,
        "arenaHeight": 1000
      },
      "parallax": {
        "bgColor": "#080810",
        "nebula": {
          "enabled": true,
          "count": 5,
          "color": "#221144"
        }
      },
      "rewards": {
        "completionScrap": 500
      }
    }
  },
  "affixes": {
    "prefixes": {
      "damage": [
        {
          "id": "sharp",
          "name": "Sharp",
          "stat": "damage",
          "range": [
            2,
            5
          ],
          "tiers": [
            "common",
            "uncommon"
          ]
        },
        {
          "id": "deadly",
          "name": "Deadly",
          "stat": "damage",
          "range": [
            5,
            10
          ],
          "tiers": [
            "uncommon",
            "rare"
          ]
        },
        {
          "id": "vicious",
          "name": "Vicious",
          "stat": "damage",
          "range": [
            10,
            18
          ],
          "tiers": [
            "rare",
            "epic"
          ]
        },
        {
          "id": "brutal",
          "name": "Brutal",
          "stat": "damage",
          "range": [
            18,
            28
          ],
          "tiers": [
            "epic",
            "legendary"
          ]
        },
        {
          "id": "annihilating",
          "name": "Annihilating",
          "stat": "damage",
          "range": [
            28,
            40
          ],
          "tiers": [
            "legendary",
            "mythic"
          ]
        }
      ],
      "fireRate": [
        {
          "id": "quick",
          "name": "Quick",
          "stat": "fireRate",
          "range": [
            0.3,
            0.6
          ],
          "tiers": [
            "common",
            "uncommon"
          ]
        },
        {
          "id": "rapid",
          "name": "Rapid",
          "stat": "fireRate",
          "range": [
            0.6,
            1
          ],
          "tiers": [
            "uncommon",
            "rare"
          ]
        },
        {
          "id": "furious",
          "name": "Furious",
          "stat": "fireRate",
          "range": [
            1,
            1.5
          ],
          "tiers": [
            "rare",
            "epic"
          ]
        },
        {
          "id": "frenzied",
          "name": "Frenzied",
          "stat": "fireRate",
          "range": [
            1.5,
            2.5
          ],
          "tiers": [
            "epic",
            "legendary"
          ]
        }
      ],
      "crit": [
        {
          "id": "keen",
          "name": "Keen",
          "stat": "critChance",
          "range": [
            3,
            6
          ],
          "tiers": [
            "common",
            "uncommon",
            "rare"
          ]
        },
        {
          "id": "precise",
          "name": "Precise",
          "stat": "critChance",
          "range": [
            6,
            10
          ],
          "tiers": [
            "rare",
            "epic"
          ]
        },
        {
          "id": "lethal",
          "name": "Lethal",
          "stat": "critChance",
          "range": [
            10,
            15
          ],
          "tiers": [
            "epic",
            "legendary",
            "mythic"
          ]
        }
      ],
      "special": [
        {
          "id": "vampiric",
          "name": "Vampiric",
          "stat": "lifesteal",
          "range": [
            1,
            3
          ],
          "tiers": [
            "rare",
            "epic",
            "legendary"
          ]
        },
        {
          "id": "ethereal",
          "name": "Ethereal",
          "stat": "piercing",
          "range": [
            1,
            1
          ],
          "tiers": [
            "epic",
            "legendary",
            "mythic"
          ]
        },
        {
          "id": "quantum",
          "name": "Quantum",
          "stat": "projectiles",
          "range": [
            1,
            1
          ],
          "tiers": [
            "legendary",
            "mythic"
          ]
        },
        {
          "id": "berserker",
          "name": "Berserker",
          "stat": "berserkDamage",
          "range": [
            10,
            25
          ],
          "tiers": [
            "epic",
            "legendary"
          ]
        }
      ],
      "defense": [
        {
          "id": "reinforced",
          "name": "Reinforced",
          "stat": "shieldCap",
          "range": [
            10,
            25
          ],
          "tiers": [
            "common",
            "uncommon",
            "rare"
          ]
        },
        {
          "id": "fortified",
          "name": "Fortified",
          "stat": "shieldCap",
          "range": [
            25,
            45
          ],
          "tiers": [
            "rare",
            "epic",
            "legendary"
          ]
        },
        {
          "id": "hardened",
          "name": "Hardened",
          "stat": "maxHP",
          "range": [
            10,
            25
          ],
          "tiers": [
            "common",
            "uncommon",
            "rare"
          ]
        },
        {
          "id": "stalwart",
          "name": "Stalwart",
          "stat": "maxHP",
          "range": [
            25,
            50
          ],
          "tiers": [
            "rare",
            "epic",
            "legendary"
          ]
        }
      ]
    },
    "suffixes": {
      "defense": [
        {
          "id": "of_protection",
          "name": "of Protection",
          "stat": "shieldCap",
          "range": [
            10,
            25
          ],
          "tiers": [
            "common",
            "uncommon"
          ]
        },
        {
          "id": "of_the_fortress",
          "name": "of the Fortress",
          "stat": "shieldCap",
          "range": [
            25,
            50
          ],
          "tiers": [
            "rare",
            "epic"
          ]
        },
        {
          "id": "of_invincibility",
          "name": "of Invincibility",
          "stat": "shieldCap",
          "range": [
            50,
            80
          ],
          "tiers": [
            "legendary",
            "mythic"
          ]
        }
      ],
      "speed": [
        {
          "id": "of_swiftness",
          "name": "of Swiftness",
          "stat": "speed",
          "range": [
            3,
            8
          ],
          "tiers": [
            "common",
            "uncommon",
            "rare"
          ]
        },
        {
          "id": "of_the_wind",
          "name": "of the Wind",
          "stat": "speed",
          "range": [
            8,
            15
          ],
          "tiers": [
            "rare",
            "epic"
          ]
        },
        {
          "id": "of_light",
          "name": "of Light",
          "stat": "speed",
          "range": [
            15,
            22
          ],
          "tiers": [
            "epic",
            "legendary",
            "mythic"
          ]
        }
      ],
      "luck": [
        {
          "id": "of_fortune",
          "name": "of Fortune",
          "stat": "luck",
          "range": [
            2,
            5
          ],
          "tiers": [
            "uncommon",
            "rare",
            "epic"
          ]
        },
        {
          "id": "of_prosperity",
          "name": "of Prosperity",
          "stat": "scrapBonus",
          "range": [
            10,
            25
          ],
          "tiers": [
            "rare",
            "epic",
            "legendary"
          ]
        },
        {
          "id": "of_the_collector",
          "name": "of the Collector",
          "stat": "dropBonus",
          "range": [
            5,
            15
          ],
          "tiers": [
            "epic",
            "legendary",
            "mythic"
          ]
        }
      ],
      "vitality": [
        {
          "id": "of_vitality",
          "name": "of Vitality",
          "stat": "maxHP",
          "range": [
            10,
            25
          ],
          "tiers": [
            "common",
            "uncommon",
            "rare"
          ]
        },
        {
          "id": "of_the_titan",
          "name": "of the Titan",
          "stat": "maxHP",
          "range": [
            25,
            50
          ],
          "tiers": [
            "rare",
            "epic",
            "legendary"
          ]
        },
        {
          "id": "of_immortality",
          "name": "of Immortality",
          "stat": "maxHP",
          "range": [
            50,
            100
          ],
          "tiers": [
            "legendary",
            "mythic"
          ]
        }
      ],
      "special": [
        {
          "id": "of_the_phoenix",
          "name": "of the Phoenix",
          "stat": "reviveChance",
          "range": [
            10,
            25
          ],
          "tiers": [
            "legendary",
            "mythic"
          ]
        },
        {
          "id": "of_devastation",
          "name": "of Devastation",
          "stat": "critDamage",
          "range": [
            25,
            50
          ],
          "tiers": [
            "epic",
            "legendary",
            "mythic"
          ]
        },
        {
          "id": "of_infinity",
          "name": "of Infinity",
          "stat": "energyRegen",
          "range": [
            20,
            40
          ],
          "tiers": [
            "epic",
            "legendary"
          ]
        },
        {
          "id": "of_the_void",
          "name": "of the Void",
          "stat": "voidDamage",
          "range": [
            10,
            25
          ],
          "tiers": [
            "mythic"
          ]
        }
      ]
    }
  },
  "config": {
    "version": "2.3.0",
    "name": "BONZOOKAA!",
    "player": {
      "baseHP": 100,
      "baseDamage": 8,
      "baseSpeed": 320,
      "baseFireRate": 3.5,
      "baseCritChance": 5,
      "baseCritDamage": 150,
      "basePickupRadius": 60,
      "bulletSpeed": 800,
      "acceleration": 3000,
      "friction": 0.65,
      "deadzone": 0.1,
      "shieldRegenRate": 5,
      "shieldRegenDelay": 3
    },
    "progression": {
      "baseXP": 100,
      "xpScale": 1.15,
      "maxLevel": 0,
      "skillPerLevel": 1,
      "statPerLevel": 3
    },
    "mastery": {
      "baseXP": 500,
      "xpScale": 1.08,
      "enabled": true
    },
    "waves": {
      "vendorInterval": 5,
      "vendorStart": 3,
      "bossInterval": 10,
      "eliteChance": 0.12,
      "baseEnemyCount": 4,
      "enemyCountScale": 0.6,
      "scaleMode": "exponential",
      "scaleBase": 1.12,
      "scaleLinear": 0.08,
      "eliteHPMult": 2.5,
      "bossHPMult": 8
    },
    "economy": {
      "scrapPerKill": 5,
      "cellsPerKill": 5,
      "bossScrapMult": 10,
      "eliteScrapMult": 3
    },
    "loot": {
      "baseDropChance": 0.05,
      "bossDropChance": 1,
      "eliteDropChance": 0.3,
      "uniqueDropChance": 0.005,
      "pity": {
        "enabled": true,
        "rareGuarantee": 40,
        "legendaryGuarantee": 200,
        "uniqueGuarantee": 500
      },
      "ilvlGating": {
        "common": 1,
        "uncommon": 1,
        "rare": 3,
        "epic": 8,
        "legendary": 15,
        "mythic": 30
      }
    },
    "stash": {
      "baseSlots": 56,
      "maxSlots": 200
    },
    "antiExploit": {
      "enabled": true,
      "maxSeedReuse": 3,
      "seedHistorySize": 50,
      "resetCooldownMs": 30000,
      "maxResetsPerHour": 10,
      "evWindowMs": 300000,
      "evScrapSpikeThresh": 5,
      "evItemSpikeThresh": 4,
      "scrapCapPerDepth": 2000
    },
    "effects": {
      "damageNumbers": {
        "baseSize": 16,
        "critSize": 28,
        "normalColor": "#ffffff",
        "critColor": "#ffcc00",
        "bigHitColor": "#ff6600",
        "floatSpeed": 120,
        "duration": 0.9,
        "spread": 30
      },
      "screenShake": {
        "enabled": true,
        "killIntensity": 2,
        "critIntensity": 4,
        "bossIntensity": 10
      }
    },
    "exploration": {
      "bossEveryNZones": 10,
      "mapScale": 2,
      "enemyDensityMult": 0.55,
      "eliteDensityMult": 0.7,
      "maxEnemySpawnsPerZone": 60,
      "maxEliteSpawnsPerZone": 5,
      "enemySpawnMinDistBetween": 120,
      "enemySpawnMinDistFromSpawn": 280,
      "enemySpawnMinDistFromExit": 180,
      "spawnViewMargin": 520,
      "despawnViewMargin": 1600,
      "portalInteractRadius": 75,
      "enemyAggroRangeMult": 0.75,
      "enemyFireIntervalMult": 1.75,
      "maxStarsBackground": 800,
      "maxStarsMidground": 500,
      "maxDecorationsPerZone": 3000,
      "maxObstaclesPerZone": 50
    },
    "asteroids": {
      "enabled": true,
      "maxPerZone": 30,
      "playerCollisionDamagePct": 0.05,
      "playerCollisionCooldown": 0.75,
      "knockbackStrength": 280,
      "scrapMin": 2,
      "scrapMax": 6,
      "spritePaths": [
        "./assets/asteroids/asteroid_1.png",
        "./assets/asteroids/asteroid_2.png"
      ],
      "minNearSpawn": 6,
      "nearSpawnRadius": 1400
    },
    "background": {
      "enabled": true,
      "tileScale": 1,
      "tileByAct": {
        "act1": "./assets/backgrounds/tile_city_ruins.webp",
        "act2": "./assets/backgrounds/tile_toxicity.webp",
        "act3": "./assets/backgrounds/tile_void.webp"
      },
      "deco": {
        "enabled": true,
        "count": 6,
        "scrollSpeed": 0.55,
        "spritePaths": [
          "./assets/asteroids_deco/asteroid_deco_1.png",
          "./assets/asteroids_deco/asteroid_deco_2.png",
          "./assets/asteroids_deco/asteroid_deco_3.png",
          "./assets/asteroids_deco/asteroid_deco_4.png",
          "./assets/asteroids_deco/asteroid_deco_big.png"
        ],
        "alphaMin": 0.25,
        "alphaMax": 0.65,
        "scaleMin": 0.35,
        "scaleMax": 1.1
      },
      "fog": {
        "enabled": true,
        "count": 1,
        "scrollSpeed": 0.12,
        "driftSpeed": 32,
        "paths": [
          "./assets/fog/fog_1.png",
          "./assets/fog/fog_5.png",
          "./assets/fog/fog_14.png"
        ]
      }
    }
  },
  "crafting": {
    "_version": "1.0.0",
    "_comment": "Crafting uses Scrap + Cells as currencies. Deterministic parts + stochastic parts. Costs escalate to prevent perfect items.",
    "currencies": {
      "scrap": {
        "name": "Scrap",
        "icon": "⚙️",
        "description": "Salvaged parts from enemies and asteroids",
        "maxStack": 999999
      },
      "cells": {
        "name": "Energy Cells",
        "icon": "🔋",
        "description": "Power cells from defeated foes",
        "maxStack": 999999
      },
      "voidShard": {
        "name": "Void Shard",
        "icon": "💠",
        "description": "Rare material from depth 50+ bosses",
        "maxStack": 999,
        "minDepthDrop": 50,
        "bossOnly": true,
        "dropChance": 0.25
      },
      "cosmicDust": {
        "name": "Cosmic Dust",
        "icon": "✨",
        "description": "Ultra-rare material from depth 100+ elites",
        "maxStack": 99,
        "minDepthDrop": 100,
        "dropChance": 0.05
      }
    },
    "recipes": {
      "reroll_affixes": {
        "name": "Reroll Affixes",
        "description": "Randomize all affixes on an item (keeps base stats, rarity, base type)",
        "icon": "🎲",
        "costs": {
          "scrap": {
            "base": 100,
            "perRarity": {
              "common": 1,
              "uncommon": 2,
              "rare": 5,
              "epic": 12,
              "legendary": 30,
              "mythic": 80
            }
          },
          "cells": {
            "base": 50,
            "perRarity": {
              "common": 1,
              "uncommon": 1,
              "rare": 3,
              "epic": 8,
              "legendary": 20,
              "mythic": 50
            }
          }
        },
        "escalation": {
          "enabled": true,
          "perUse": 1.15,
          "maxMult": 5,
          "resetsOn": "newItem"
        },
        "constraints": {
          "minRarity": "uncommon",
          "notUnique": true
        }
      },
      "upgrade_rarity": {
        "name": "Upgrade Rarity",
        "description": "Attempt to raise item rarity by one tier. Success chance decreases with rarity.",
        "icon": "⬆️",
        "costs": {
          "scrap": {
            "base": 500,
            "perRarity": {
              "common": 1,
              "uncommon": 3,
              "rare": 8,
              "epic": 20,
              "legendary": 50
            }
          },
          "cells": {
            "base": 200,
            "perRarity": {
              "common": 1,
              "uncommon": 2,
              "rare": 5,
              "epic": 15,
              "legendary": 40
            }
          },
          "voidShard": {
            "base": 0,
            "perRarity": {
              "common": 0,
              "uncommon": 0,
              "rare": 0,
              "epic": 1,
              "legendary": 3
            }
          }
        },
        "successChance": {
          "common": 0.9,
          "uncommon": 0.7,
          "rare": 0.45,
          "epic": 0.2,
          "legendary": 0.05
        },
        "onFail": "keepItem",
        "constraints": {
          "maxRarity": "legendary",
          "notUnique": true
        }
      },
      "reroll_single_affix": {
        "name": "Reroll Single Affix",
        "description": "Reroll one specific affix on an item. Other affixes are preserved.",
        "icon": "🎯",
        "costs": {
          "scrap": {
            "base": 200,
            "perRarity": {
              "common": 1,
              "uncommon": 2,
              "rare": 4,
              "epic": 10,
              "legendary": 25,
              "mythic": 60
            }
          },
          "cells": {
            "base": 100,
            "perRarity": {
              "common": 1,
              "uncommon": 1,
              "rare": 2,
              "epic": 6,
              "legendary": 15,
              "mythic": 40
            }
          }
        },
        "escalation": {
          "enabled": true,
          "perUse": 1.25,
          "maxMult": 8,
          "resetsOn": "newAffix"
        },
        "constraints": {
          "minAffixes": 1,
          "notUnique": true
        }
      },
      "add_affix": {
        "name": "Add Affix",
        "description": "Add a random affix to an item that has room for more.",
        "icon": "➕",
        "costs": {
          "scrap": {
            "base": 400,
            "perRarity": {
              "common": 2,
              "uncommon": 4,
              "rare": 8,
              "epic": 16,
              "legendary": 35,
              "mythic": 70
            }
          },
          "cells": {
            "base": 150,
            "perRarity": {
              "common": 1,
              "uncommon": 2,
              "rare": 4,
              "epic": 10,
              "legendary": 20,
              "mythic": 45
            }
          },
          "voidShard": {
            "base": 0,
            "perRarity": {
              "common": 0,
              "uncommon": 0,
              "rare": 0,
              "epic": 0,
              "legendary": 1,
              "mythic": 2
            }
          }
        },
        "constraints": {
          "mustHaveRoom": true,
          "notUnique": true
        }
      },
      "salvage_advanced": {
        "name": "Salvage for Materials",
        "description": "Destroy an epic+ item to extract rare crafting materials.",
        "icon": "🔨",
        "costs": {},
        "yields": {
          "epic": {
            "voidShard": [
              0,
              1
            ],
            "scrap": [
              100,
              200
            ]
          },
          "legendary": {
            "voidShard": [
              1,
              3
            ],
            "cosmicDust": [
              0,
              1
            ],
            "scrap": [
              300,
              500
            ]
          },
          "mythic": {
            "voidShard": [
              3,
              5
            ],
            "cosmicDust": [
              1,
              2
            ],
            "scrap": [
              500,
              1000
            ]
          }
        },
        "constraints": {
          "minRarity": "epic",
          "destroysItem": true
        }
      },
      "enchant_boost": {
        "name": "Enchant: Boost Stats",
        "description": "Increase all base stat rolls by 10-20%. Can be applied 3 times max.",
        "icon": "🌟",
        "costs": {
          "scrap": {
            "base": 800,
            "perUse": 2
          },
          "cells": {
            "base": 400,
            "perUse": 2
          },
          "cosmicDust": {
            "base": 1,
            "perUse": 1
          }
        },
        "maxUses": 3,
        "boostRange": [
          0.1,
          0.2
        ],
        "constraints": {
          "minRarity": "rare",
          "notUnique": true
        }
      }
    },
    "antiExploit": {
      "maxCraftsPerMinute": 10,
      "maxRerollsPerItem": 50,
      "costFloorPercent": 0.25,
      "craftLogEnabled": true
    }
  },
  "enemies": {
    "basic": {
      "grunt": {
        "name": "Grunt",
        "icon": "👾",
        "hp": 40,
        "damage": 8,
        "speed": 70,
        "score": 10,
        "xp": 5,
        "pattern": "straight",
        "color": "#44aa44",
        "shootInterval": 2.5
      },
      "scout": {
        "name": "Scout",
        "icon": "🛸",
        "hp": 25,
        "damage": 5,
        "speed": 110,
        "score": 15,
        "xp": 7,
        "pattern": "zigzag",
        "color": "#44aaff",
        "shootInterval": 2
      },
      "diver": {
        "name": "Diver",
        "icon": "🔻",
        "hp": 35,
        "damage": 12,
        "speed": 140,
        "score": 20,
        "xp": 10,
        "pattern": "dive",
        "color": "#ff4444",
        "shootInterval": 1.8
      },
      "tank": {
        "name": "Tank",
        "icon": "🔷",
        "hp": 100,
        "damage": 15,
        "speed": 35,
        "score": 30,
        "xp": 15,
        "pattern": "straight",
        "color": "#888888",
        "shootInterval": 1.5
      },
      "corrupted": {
        "name": "Corrupted Spawn",
        "icon": "☣️",
        "hp": 45,
        "damage": 4,
        "speed": 55,
        "score": 55,
        "xp": 28,
        "pattern": "strafe",
        "color": "#c6a24a",
        "shootInterval": 0.45,
        "abilities": [
          "corruptDot"
        ],
        "dot": {
          "duration": 4,
          "tick": 0.5,
          "dpsPctMaxHp": 0.01
        }
      },
      "repair_drone": {
        "name": "Repair Drone",
        "icon": "🛠️",
        "hp": 25,
        "damage": 0,
        "speed": 90,
        "score": 15,
        "xp": 8,
        "pattern": "orbit",
        "color": "#66ddff",
        "shootInterval": 9999,
        "abilities": [
          "repairTether"
        ],
        "repair": {
          "range": 260,
          "healPctMaxHpPerSec": 0.03,
          "capPctMaxHpPerSec": 0.04
        }
      },
      "bomber": {
        "name": "Bomber",
        "icon": "💣",
        "hp": 55,
        "damage": 6,
        "speed": 50,
        "score": 45,
        "xp": 25,
        "pattern": "wander",
        "color": "#ff6633",
        "shootInterval": 3,
        "abilities": [
          "layMines"
        ],
        "mineInterval": 2.5,
        "mineCount": 1,
        "mineDamage": 12,
        "mineLife": 15
      },
      "cloaker": {
        "name": "Cloaker",
        "icon": "👻",
        "hp": 30,
        "damage": 18,
        "speed": 95,
        "score": 60,
        "xp": 30,
        "pattern": "strafe",
        "color": "#8844cc",
        "shootInterval": 1.8,
        "abilities": [
          "cloak"
        ],
        "cloakRange": 250,
        "uncloakRange": 120,
        "cloakAlpha": 0.08
      },
      "summoner": {
        "name": "Summoner",
        "icon": "✨",
        "hp": 65,
        "damage": 5,
        "speed": 40,
        "score": 70,
        "xp": 35,
        "pattern": "static",
        "color": "#cc44ff",
        "shootInterval": 2,
        "abilities": [
          "summon"
        ],
        "summonInterval": 6,
        "summonType": "grunt",
        "summonMax": 3
      },
      "turret": {
        "name": "Turret",
        "icon": "🏯",
        "hp": 80,
        "damage": 20,
        "speed": 0,
        "score": 50,
        "xp": 28,
        "pattern": "static",
        "color": "#ccaa33",
        "shootInterval": 1.2,
        "abilities": [
          "stationary",
          "rapidFire"
        ],
        "burstCount": 3,
        "burstDelay": 0.15
      },
      "shielder": {
        "name": "Shielder",
        "icon": "🛡️",
        "hp": 50,
        "damage": 6,
        "speed": 55,
        "score": 55,
        "xp": 30,
        "pattern": "circle",
        "color": "#33aacc",
        "shootInterval": 2.5,
        "abilities": [
          "projectBarrier"
        ],
        "barrierRadius": 100,
        "barrierArc": 1.2,
        "barrierHP": 40
      }
    },
    "elite": {
      "commander": {
        "name": "Commander",
        "icon": "⭐",
        "hp": 150,
        "damage": 20,
        "speed": 50,
        "score": 100,
        "xp": 50,
        "pattern": "command",
        "color": "#ffaa00",
        "shootInterval": 1.2,
        "abilities": [
          "summon",
          "shield"
        ]
      },
      "berserker": {
        "name": "Berserker",
        "icon": "💢",
        "hp": 120,
        "damage": 30,
        "speed": 90,
        "score": 120,
        "xp": 60,
        "pattern": "charge",
        "color": "#ff2222",
        "shootInterval": 0.8,
        "abilities": [
          "enrage"
        ]
      },
      "sniper": {
        "name": "Sniper",
        "icon": "🎯",
        "hp": 60,
        "damage": 40,
        "speed": 25,
        "score": 80,
        "xp": 40,
        "pattern": "strafe",
        "color": "#aa44ff",
        "shootInterval": 2.5,
        "abilities": [
          "aimShot"
        ]
      }
    },
    "bosses": {
      "sentinel": {
        "name": "Sentinel Alpha",
        "icon": "👑",
        "hp": 800,
        "damage": 25,
        "speed": 35,
        "score": 500,
        "xp": 200,
        "pattern": "boss_sentinel",
        "color": "#ff8800",
        "shootInterval": 0.6,
        "phases": 3,
        "abilities": [
          "laser_sweep",
          "spawn_adds",
          "shield_phase"
        ]
      },
      "collector": {
        "name": "The Collector",
        "icon": "🕷️",
        "hp": 1200,
        "damage": 30,
        "speed": 45,
        "score": 800,
        "xp": 350,
        "pattern": "boss_collector",
        "color": "#aa00ff",
        "shootInterval": 0.5,
        "phases": 4,
        "abilities": [
          "tractor_beam",
          "drone_swarm",
          "teleport"
        ]
      },
      "harbinger": {
        "name": "Harbinger",
        "icon": "💀",
        "hp": 2000,
        "damage": 45,
        "speed": 55,
        "score": 1200,
        "xp": 500,
        "pattern": "boss_harbinger",
        "color": "#ff0044",
        "shootInterval": 0.4,
        "phases": 5,
        "abilities": [
          "void_beam",
          "meteor_shower",
          "time_slow",
          "rage_mode"
        ]
      }
    },
    "patterns": {
      "straight": {
        "description": "Move straight down",
        "movement": [
          {
            "dy": 1,
            "duration": -1
          }
        ]
      },
      "zigzag": {
        "description": "Zigzag left and right",
        "movement": [
          {
            "dx": 1,
            "dy": 0.3,
            "duration": 0.5
          },
          {
            "dx": -1,
            "dy": 0.3,
            "duration": 0.5
          }
        ],
        "loop": true
      },
      "dive": {
        "description": "Slow then fast dive",
        "movement": [
          {
            "dy": 0.3,
            "duration": 1.5
          },
          {
            "dy": 2,
            "duration": 1
          }
        ]
      },
      "snake": {
        "description": "S-curve pattern",
        "movement": [
          {
            "dx": 0.8,
            "dy": 0.5,
            "duration": 0.8
          },
          {
            "dx": -0.8,
            "dy": 0.5,
            "duration": 0.8
          }
        ],
        "loop": true
      },
      "charge": {
        "description": "Wait then charge at player",
        "movement": [
          {
            "dy": 0.2,
            "duration": 1
          },
          {
            "target": "player",
            "speed": 2,
            "duration": 2
          }
        ]
      },
      "strafe": {
        "description": "Move to side, stop and shoot",
        "movement": [
          {
            "dx": 1,
            "dy": 0.3,
            "duration": 1.5
          },
          {
            "stop": true,
            "shoot": true,
            "duration": 2
          },
          {
            "dx": -1,
            "dy": 0.3,
            "duration": 1.5
          }
        ],
        "loop": true
      }
    },
    "waveCompositions": {
      "1-5": {
        "pool": [
          "grunt"
        ],
        "count": [
          4,
          6
        ],
        "eliteChance": 0
      },
      "6-10": {
        "pool": [
          "grunt",
          "scout"
        ],
        "count": [
          5,
          8
        ],
        "eliteChance": 0.05
      },
      "11-20": {
        "pool": [
          "grunt",
          "scout",
          "diver",
          "repair_drone"
        ],
        "count": [
          6,
          10
        ],
        "eliteChance": 0.1
      },
      "21-30": {
        "pool": [
          "grunt",
          "scout",
          "diver",
          "tank",
          "turret"
        ],
        "count": [
          8,
          12
        ],
        "eliteChance": 0.15
      },
      "31-50": {
        "pool": [
          "scout",
          "diver",
          "tank",
          "bomber",
          "cloaker",
          "turret"
        ],
        "count": [
          10,
          15
        ],
        "eliteChance": 0.2
      },
      "51-100": {
        "pool": [
          "diver",
          "tank",
          "bomber",
          "cloaker",
          "summoner",
          "turret",
          "shielder"
        ],
        "count": [
          12,
          18
        ],
        "eliteChance": 0.25
      },
      "101+": {
        "pool": [
          "tank",
          "bomber",
          "cloaker",
          "summoner",
          "turret",
          "shielder",
          "corrupted"
        ],
        "count": [
          14,
          22
        ],
        "eliteChance": 0.3
      }
    }
  },
  "items": {
    "weapons": {
      "laser_cannon": {
        "name": "Laser Cannon",
        "slot": "weapon",
        "icon": "🔫",
        "description": "Balanced energy weapon",
        "stats": {
          "damage": [
            8,
            12
          ],
          "fireRate": [
            0.5,
            1.5
          ]
        },
        "rarities": [
          "common",
          "uncommon",
          "rare",
          "epic",
          "legendary"
        ]
      },
      "plasma_spreader": {
        "name": "Plasma Spreader",
        "slot": "weapon",
        "icon": "🔥",
        "description": "Wide-arc plasma bursts",
        "stats": {
          "damage": [
            5,
            8
          ],
          "projectiles": [
            2,
            3
          ]
        },
        "rarities": [
          "uncommon",
          "rare",
          "epic",
          "legendary"
        ]
      },
      "railgun": {
        "name": "Railgun",
        "slot": "weapon",
        "icon": "⚡",
        "description": "Devastating piercing shots",
        "stats": {
          "damage": [
            25,
            40
          ],
          "piercing": [
            2,
            3
          ]
        },
        "rarities": [
          "rare",
          "epic",
          "legendary",
          "mythic"
        ]
      },
      "gatling_laser": {
        "name": "Gatling Laser",
        "slot": "weapon",
        "icon": "💥",
        "description": "Rapid-fire energy barrage",
        "stats": {
          "damage": [
            3,
            5
          ],
          "fireRate": [
            15,
            20
          ]
        },
        "rarities": [
          "uncommon",
          "rare",
          "epic",
          "legendary"
        ]
      },
      "nova_emitter": {
        "name": "Nova Emitter",
        "slot": "weapon",
        "icon": "💫",
        "description": "360° burst attack",
        "stats": {
          "damage": [
            15,
            25
          ],
          "aoeRadius": [
            80,
            120
          ]
        },
        "rarities": [
          "epic",
          "legendary",
          "mythic"
        ]
      }
    },
    "secondary": {
      "missile_pod": {
        "name": "Missile Pod",
        "slot": "secondary",
        "icon": "🚀",
        "description": "Homing missile launcher",
        "stats": {
          "damage": [
            15,
            25
          ],
          "tracking": [
            60,
            80
          ]
        },
        "rarities": [
          "uncommon",
          "rare",
          "epic",
          "legendary"
        ]
      },
      "mine_layer": {
        "name": "Mine Layer",
        "slot": "secondary",
        "icon": "💣",
        "description": "Deploys proximity mines",
        "stats": {
          "damage": [
            20,
            35
          ],
          "mineCount": [
            2,
            3
          ]
        },
        "rarities": [
          "rare",
          "epic",
          "legendary"
        ]
      }
    },
    "shields": {
      "energy_barrier": {
        "name": "Energy Barrier",
        "slot": "shield",
        "icon": "🛡️",
        "description": "Standard shield generator",
        "stats": {
          "shieldCap": [
            30,
            50
          ],
          "shieldRegen": [
            2,
            4
          ]
        },
        "rarities": [
          "common",
          "uncommon",
          "rare",
          "epic",
          "legendary"
        ]
      },
      "deflector": {
        "name": "Deflector Array",
        "slot": "shield",
        "icon": "🔰",
        "description": "Chance to reflect projectiles",
        "stats": {
          "shieldCap": [
            20,
            35
          ],
          "deflectChance": [
            5,
            12
          ]
        },
        "rarities": [
          "rare",
          "epic",
          "legendary"
        ]
      },
      "phase_shield": {
        "name": "Phase Shield",
        "slot": "shield",
        "icon": "🌀",
        "description": "Brief invulnerability on break",
        "stats": {
          "shieldCap": [
            25,
            40
          ],
          "phaseTime": [
            0.5,
            1
          ]
        },
        "rarities": [
          "epic",
          "legendary",
          "mythic"
        ]
      }
    },
    "engines": {
      "ion_thruster": {
        "name": "Ion Thruster",
        "slot": "engine",
        "icon": "🔹",
        "description": "Reliable propulsion",
        "stats": {
          "speed": [
            20,
            40
          ],
          "acceleration": [
            100,
            200
          ]
        },
        "rarities": [
          "common",
          "uncommon",
          "rare",
          "epic"
        ]
      },
      "quantum_drive": {
        "name": "Quantum Drive",
        "slot": "engine",
        "icon": "⚡",
        "description": "Includes dash ability",
        "stats": {
          "speed": [
            30,
            50
          ],
          "dashCharges": [
            1,
            2
          ]
        },
        "rarities": [
          "rare",
          "epic",
          "legendary"
        ]
      },
      "warp_core": {
        "name": "Warp Core",
        "slot": "engine",
        "icon": "🌟",
        "description": "Short-range teleport",
        "stats": {
          "speed": [
            25,
            45
          ],
          "warpRange": [
            100,
            150
          ]
        },
        "rarities": [
          "legendary",
          "mythic"
        ]
      }
    },
    "reactors": {
      "fusion_core": {
        "name": "Fusion Core",
        "slot": "reactor",
        "icon": "☢️",
        "description": "Standard power plant",
        "stats": {
          "energyCap": [
            50,
            80
          ],
          "energyRegen": [
            5,
            8
          ]
        },
        "rarities": [
          "common",
          "uncommon",
          "rare",
          "epic"
        ]
      },
      "antimatter_cell": {
        "name": "Antimatter Cell",
        "slot": "reactor",
        "icon": "💠",
        "description": "High-output reactor",
        "stats": {
          "energyCap": [
            70,
            110
          ],
          "energyRegen": [
            7,
            12
          ]
        },
        "rarities": [
          "epic",
          "legendary",
          "mythic"
        ]
      }
    },
    "modules": {
      "damage_amp": {
        "name": "Damage Amplifier",
        "slot": "module1",
        "icon": "🔴",
        "description": "Increases weapon damage",
        "stats": {
          "damageBonus": [
            3,
            8
          ]
        },
        "rarities": [
          "common",
          "uncommon",
          "rare",
          "epic",
          "legendary"
        ]
      },
      "targeting_cpu": {
        "name": "Targeting CPU",
        "slot": "module1",
        "icon": "🎯",
        "description": "Improves accuracy and crits",
        "stats": {
          "critChance": [
            2,
            5
          ],
          "accuracy": [
            3,
            6
          ]
        },
        "rarities": [
          "uncommon",
          "rare",
          "epic",
          "legendary"
        ]
      },
      "scrap_magnet": {
        "name": "Scrap Magnet",
        "slot": "module2",
        "icon": "🧲",
        "description": "Pulls in nearby pickups",
        "stats": {
          "pickupRadius": [
            15,
            30
          ],
          "scrapBonus": [
            3,
            8
          ]
        },
        "rarities": [
          "common",
          "uncommon",
          "rare",
          "epic"
        ]
      },
      "lucky_charm": {
        "name": "Lucky Charm",
        "slot": "module3",
        "icon": "🍀",
        "description": "Increases drop rates",
        "stats": {
          "luck": [
            5,
            15
          ],
          "dropBonus": [
            3,
            10
          ]
        },
        "rarities": [
          "uncommon",
          "rare",
          "epic",
          "legendary"
        ]
      },
      "armor_plating": {
        "name": "Armor Plating",
        "slot": "module2",
        "icon": "🔩",
        "description": "Increases hull strength",
        "stats": {
          "maxHP": [
            15,
            35
          ]
        },
        "rarities": [
          "common",
          "uncommon",
          "rare",
          "epic"
        ]
      },
      "vampiric_core": {
        "name": "Vampiric Core",
        "slot": "module3",
        "icon": "🩸",
        "description": "Steal life from enemies",
        "stats": {
          "lifesteal": [
            2,
            6
          ]
        },
        "rarities": [
          "rare",
          "epic",
          "legendary",
          "mythic"
        ]
      }
    },
    "drones": {
      "attack_drone": {
        "name": "Attack Drone",
        "slot": "drone",
        "icon": "🤖",
        "description": "Autonomous combat assistant",
        "stats": {
          "droneDamage": [
            3,
            6
          ],
          "droneFireRate": [
            2,
            3
          ]
        },
        "rarities": [
          "uncommon",
          "rare",
          "epic",
          "legendary"
        ]
      },
      "repair_drone": {
        "name": "Repair Drone",
        "slot": "drone",
        "icon": "🔧",
        "description": "Heals hull over time",
        "stats": {
          "hpRegen": [
            1,
            2
          ],
          "repairBurst": [
            5,
            12
          ]
        },
        "rarities": [
          "rare",
          "epic",
          "legendary"
        ]
      },
      "shield_drone": {
        "name": "Shield Drone",
        "slot": "drone",
        "icon": "🛡️",
        "description": "Projects protective field",
        "stats": {
          "droneShield": [
            15,
            25
          ],
          "shieldRegen": [
            1,
            3
          ]
        },
        "rarities": [
          "rare",
          "epic",
          "legendary"
        ]
      },
      "scavenger_drone": {
        "name": "Scavenger Drone",
        "slot": "drone",
        "icon": "🔭",
        "description": "Auto-collects loot",
        "stats": {
          "collectRange": [
            100,
            180
          ],
          "scrapBonus": [
            10,
            25
          ]
        },
        "rarities": [
          "uncommon",
          "rare",
          "epic"
        ]
      }
    }
  },
  "packs": {
    "version": "9A4",
    "packChance": 0.7,
    "packSizeMin": 3,
    "packSizeMax": 5,
    "maxPacksPerZone": 6,
    "memberSpacing": 140,
    "minDistFromSpawn": 350,
    "minDistFromExit": 250,
    "templates": [
      {
        "id": "pack_swarm",
        "weight": 3,
        "types": []
      },
      {
        "id": "pack_mixed",
        "weight": 2,
        "types": []
      },
      {
        "id": "pack_repair_escort",
        "weight": 1.5,
        "members": [
          {
            "type": "breacher",
            "min": 1,
            "max": 1
          },
          {
            "type": "repair_drone",
            "min": 2,
            "max": 2
          }
        ],
        "formation": "ring"
      }
    ]
  },
  "pilotStats": {
    "power": {
      "name": "Power",
      "icon": "💪",
      "color": "#ff4444",
      "description": "+5% weapon damage per point",
      "effect": {
        "stat": "damage",
        "perPoint": 5,
        "type": "percent"
      }
    },
    "vitality": {
      "name": "Vitality",
      "icon": "❤️",
      "color": "#00ff88",
      "description": "+5% max hull HP per point",
      "effect": {
        "stat": "maxHP",
        "perPoint": 5,
        "type": "percent"
      }
    },
    "agility": {
      "name": "Agility",
      "icon": "🏃",
      "color": "#00ddff",
      "description": "+3% movement speed per point",
      "effect": {
        "stat": "speed",
        "perPoint": 3,
        "type": "percent"
      }
    },
    "precision": {
      "name": "Precision",
      "icon": "🎯",
      "color": "#ffaa00",
      "description": "+0.8% crit chance per point",
      "effect": {
        "stat": "critChance",
        "perPoint": 0.8,
        "type": "flat"
      }
    },
    "fortitude": {
      "name": "Fortitude",
      "icon": "🛡️",
      "color": "#0088ff",
      "description": "+4 shield capacity per point",
      "effect": {
        "stat": "shieldCap",
        "perPoint": 4,
        "type": "flat"
      }
    },
    "luck": {
      "name": "Luck",
      "icon": "🍀",
      "color": "#88ff00",
      "description": "+2 luck per point (drop rate & quality)",
      "effect": {
        "stat": "luck",
        "perPoint": 2,
        "type": "flat"
      }
    }
  },
  "rarities": {
    "common": {
      "name": "Common",
      "color": "#9090a0",
      "weight": 60,
      "powerMult": 1,
      "maxAffixes": 1,
      "sellMult": 1
    },
    "uncommon": {
      "name": "Uncommon",
      "color": "#00dd44",
      "weight": 25,
      "powerMult": 1.3,
      "maxAffixes": 2,
      "sellMult": 2
    },
    "rare": {
      "name": "Rare",
      "color": "#2090ff",
      "weight": 10,
      "powerMult": 1.7,
      "maxAffixes": 3,
      "sellMult": 4
    },
    "epic": {
      "name": "Epic",
      "color": "#aa44ff",
      "weight": 4,
      "powerMult": 2.2,
      "maxAffixes": 4,
      "sellMult": 8
    },
    "legendary": {
      "name": "Legendary",
      "color": "#ff8800",
      "weight": 0.9,
      "powerMult": 3,
      "maxAffixes": 5,
      "sellMult": 20,
      "glowEffect": true
    },
    "mythic": {
      "name": "Mythic",
      "color": "#ff2255",
      "weight": 0.1,
      "powerMult": 5,
      "maxAffixes": 6,
      "sellMult": 50,
      "glowEffect": true,
      "pulseAnimation": true
    }
  },
  "runUpgrades": {
    "damage": {
      "name": "Damage+",
      "icon": "🔴",
      "maxTier": 5,
      "effect": {
        "stat": "damage",
        "perTier": 10
      },
      "costs": [
        15,
        40,
        90,
        200,
        450
      ],
      "description": "+10% Damage per tier",
      "category": "offense"
    },
    "fireRate": {
      "name": "Fire Rate+",
      "icon": "⚡",
      "maxTier": 5,
      "effect": {
        "stat": "fireRate",
        "perTier": 8
      },
      "costs": [
        12,
        35,
        80,
        170,
        380
      ],
      "description": "+8% Fire Rate per tier",
      "category": "offense"
    },
    "multishot": {
      "name": "Multi-Shot",
      "icon": "🔱",
      "maxTier": 3,
      "effect": {
        "stat": "projectiles",
        "perTier": 1
      },
      "costs": [
        50,
        150,
        400
      ],
      "description": "+1 Projectile per tier",
      "category": "offense"
    },
    "shield": {
      "name": "Shield+",
      "icon": "🛡️",
      "maxTier": 5,
      "effect": {
        "stat": "shieldCap",
        "perTier": 20
      },
      "costs": [
        18,
        45,
        100,
        220,
        480
      ],
      "description": "+20 Shield per tier",
      "category": "defense"
    },
    "regen": {
      "name": "Regen+",
      "icon": "💚",
      "maxTier": 3,
      "effect": {
        "stat": "hpRegen",
        "perTier": 2
      },
      "costs": [
        25,
        80,
        220
      ],
      "description": "+2 HP/sec per tier",
      "category": "defense"
    },
    "speed": {
      "name": "Speed+",
      "icon": "💨",
      "maxTier": 3,
      "effect": {
        "stat": "speed",
        "perTier": 5
      },
      "costs": [
        15,
        45,
        120
      ],
      "description": "+5% Speed per tier",
      "category": "utility"
    },
    "magnet": {
      "name": "Magnet+",
      "icon": "🧲",
      "maxTier": 3,
      "effect": {
        "stat": "pickupRadius",
        "perTier": 35
      },
      "costs": [
        10,
        30,
        80
      ],
      "description": "+35% Pickup Radius per tier",
      "category": "utility"
    },
    "luck": {
      "name": "Luck+",
      "icon": "🍀",
      "maxTier": 3,
      "effect": {
        "stat": "dropRate",
        "perTier": 5
      },
      "costs": [
        20,
        70,
        180
      ],
      "description": "+5% Drop Rate per tier",
      "category": "utility"
    },
    "crit": {
      "name": "Critical+",
      "icon": "💥",
      "maxTier": 4,
      "effect": {
        "stat": "critChance",
        "perTier": 3
      },
      "costs": [
        25,
        65,
        160,
        380
      ],
      "description": "+3% Crit Chance per tier",
      "category": "offense"
    },
    "pierce": {
      "name": "Pierce+",
      "icon": "📍",
      "maxTier": 3,
      "effect": {
        "stat": "piercing",
        "perTier": 1
      },
      "costs": [
        35,
        100,
        280
      ],
      "description": "+1 Pierce per tier",
      "category": "offense"
    }
  },
  "skills": {
    "offensive": {
      "name": "Offensive",
      "icon": "⚔️",
      "color": "#ff4444",
      "description": "Increase damage output",
      "skills": {
        "weapon_mastery": {
          "name": "Weapon Mastery",
          "icon": "🔫",
          "maxRank": 5,
          "effect": {
            "stat": "damage",
            "perRank": 4
          },
          "description": "+4% Damage per rank",
          "requires": null
        },
        "rapid_fire": {
          "name": "Rapid Fire",
          "icon": "⚡",
          "maxRank": 5,
          "effect": {
            "stat": "fireRate",
            "perRank": 3
          },
          "description": "+3% Fire Rate per rank",
          "requires": {
            "skill": "weapon_mastery",
            "rank": 2
          }
        },
        "armor_pierce": {
          "name": "Armor Pierce",
          "icon": "🔫",
          "maxRank": 3,
          "effect": {
            "stat": "piercing",
            "perRank": 1
          },
          "description": "+1 Pierce per rank",
          "requires": {
            "skill": "weapon_mastery",
            "rank": 3
          }
        },
        "critical_expert": {
          "name": "Critical Expert",
          "icon": "💥",
          "maxRank": 5,
          "effect": {
            "stat": "critChance",
            "perRank": 2
          },
          "description": "+2% Crit Chance per rank",
          "requires": {
            "skill": "rapid_fire",
            "rank": 3
          }
        },
        "multishot": {
          "name": "Multishot",
          "icon": "🔱",
          "maxRank": 2,
          "effect": {
            "stat": "projectiles",
            "perRank": 1
          },
          "description": "+1 Projectile per rank",
          "requires": {
            "skill": "armor_pierce",
            "rank": 2
          }
        },
        "executioner": {
          "name": "Executioner",
          "icon": "☠️",
          "maxRank": 3,
          "effect": {
            "stat": "executeDamage",
            "perRank": 15
          },
          "description": "+15% damage to low HP enemies",
          "requires": {
            "skill": "critical_expert",
            "rank": 3
          }
        }
      }
    },
    "defensive": {
      "name": "Defensive",
      "icon": "🛡️",
      "color": "#00aaff",
      "description": "Increase survivability",
      "skills": {
        "shield_mastery": {
          "name": "Shield Mastery",
          "icon": "🛡️",
          "maxRank": 5,
          "effect": {
            "stat": "shieldCap",
            "perRank": 8
          },
          "description": "+8% Shield per rank",
          "requires": null
        },
        "quick_recovery": {
          "name": "Quick Recovery",
          "icon": "🔄",
          "maxRank": 5,
          "effect": {
            "stat": "shieldRegen",
            "perRank": 5
          },
          "description": "+5% Shield Regen per rank",
          "requires": {
            "skill": "shield_mastery",
            "rank": 2
          }
        },
        "hull_plating": {
          "name": "Hull Plating",
          "icon": "🔩",
          "maxRank": 5,
          "effect": {
            "stat": "maxHP",
            "perRank": 5
          },
          "description": "+5% HP per rank",
          "requires": {
            "skill": "shield_mastery",
            "rank": 2
          }
        },
        "regeneration": {
          "name": "Regeneration",
          "icon": "💚",
          "maxRank": 3,
          "effect": {
            "stat": "hpRegen",
            "perRank": 1
          },
          "description": "+1 HP/sec per rank",
          "requires": {
            "skill": "hull_plating",
            "rank": 3
          }
        },
        "deflection": {
          "name": "Deflection",
          "icon": "↩️",
          "maxRank": 3,
          "effect": {
            "stat": "deflectChance",
            "perRank": 5
          },
          "description": "+5% Deflect per rank",
          "requires": {
            "skill": "quick_recovery",
            "rank": 3
          }
        },
        "last_stand": {
          "name": "Last Stand",
          "icon": "💀",
          "maxRank": 3,
          "effect": {
            "stat": "lastStandDR",
            "perRank": 10
          },
          "description": "+10% DR when below 30% HP",
          "requires": {
            "skill": "regeneration",
            "rank": 2
          }
        }
      }
    },
    "utility": {
      "name": "Utility",
      "icon": "🔧",
      "color": "#00ff88",
      "description": "Improve efficiency and drops",
      "skills": {
        "scavenger": {
          "name": "Scavenger",
          "icon": "🧲",
          "maxRank": 5,
          "effect": {
            "stat": "pickupRadius",
            "perRank": 10
          },
          "description": "+10% Pickup Radius per rank",
          "requires": null
        },
        "lucky": {
          "name": "Lucky",
          "icon": "🍀",
          "maxRank": 5,
          "effect": {
            "stat": "dropRate",
            "perRank": 3
          },
          "description": "+3% Drop Rate per rank",
          "requires": {
            "skill": "scavenger",
            "rank": 2
          }
        },
        "speed_boost": {
          "name": "Speed Boost",
          "icon": "💨",
          "maxRank": 5,
          "effect": {
            "stat": "speed",
            "perRank": 4
          },
          "description": "+4% Speed per rank",
          "requires": {
            "skill": "scavenger",
            "rank": 2
          }
        },
        "treasure_hunter": {
          "name": "Treasure Hunter",
          "icon": "💎",
          "maxRank": 3,
          "effect": {
            "stat": "rarityBoost",
            "perRank": 5
          },
          "description": "+5% Rare+ drops per rank",
          "requires": {
            "skill": "lucky",
            "rank": 3
          }
        },
        "evasion": {
          "name": "Evasion",
          "icon": "🌀",
          "maxRank": 3,
          "effect": {
            "stat": "dodgeChance",
            "perRank": 5
          },
          "description": "+5% Dodge per rank",
          "requires": {
            "skill": "speed_boost",
            "rank": 3
          }
        },
        "xp_boost": {
          "name": "XP Boost",
          "icon": "📈",
          "maxRank": 5,
          "effect": {
            "stat": "xpBonus",
            "perRank": 4
          },
          "description": "+4% XP gain per rank",
          "requires": {
            "skill": "treasure_hunter",
            "rank": 2
          }
        }
      }
    }
  },
  "slots": {
    "weapon": {
      "name": "Primary Weapon",
      "icon": "🔫",
      "description": "Main offensive armament"
    },
    "secondary": {
      "name": "Secondary Weapon",
      "icon": "🚀",
      "description": "Support weapon system"
    },
    "shield": {
      "name": "Shield Generator",
      "icon": "🛡️",
      "description": "Defensive barrier system"
    },
    "engine": {
      "name": "Engine",
      "icon": "⚡",
      "description": "Propulsion and mobility"
    },
    "reactor": {
      "name": "Reactor Core",
      "icon": "☢️",
      "description": "Power generation"
    },
    "module1": {
      "name": "Module Slot 1",
      "icon": "🔧",
      "description": "Enhancement module"
    },
    "module2": {
      "name": "Module Slot 2",
      "icon": "🔩",
      "description": "Enhancement module"
    },
    "module3": {
      "name": "Module Slot 3",
      "icon": "⚙️",
      "description": "Enhancement module"
    },
    "drone": {
      "name": "Drone Bay",
      "icon": "🤖",
      "description": "Companion drone"
    }
  },
  "uniques": {
    "_version": "1.0.0",
    "_comment": "Unique items have FIXED stats and identities. They enable specific builds. Chase items for endgame.",
    "weapons": {
      "void_reaper": {
        "name": "Void Reaper",
        "slot": "weapon",
        "icon": "☠️",
        "rarity": "legendary",
        "minIlvl": 15,
        "dropWeight": 1,
        "description": "Shots pass through all enemies. Each pierce adds +8% damage.",
        "fixedStats": {
          "damage": 35,
          "piercing": 99,
          "pierceDamageBonus": 8
        },
        "flavor": "The void consumes all in its path."
      },
      "supernova_catalyst": {
        "name": "Supernova Catalyst",
        "slot": "weapon",
        "icon": "🌟",
        "rarity": "mythic",
        "minIlvl": 30,
        "dropWeight": 0.3,
        "description": "Every 5th shot explodes in a 200px AoE. Crit chance +15%.",
        "fixedStats": {
          "damage": 28,
          "fireRate": 12,
          "critChance": 15,
          "aoeRadius": 200,
          "aoeEveryNShots": 5
        },
        "flavor": "Stars die so that you may kill."
      },
      "phantom_gatling": {
        "name": "Phantom Gatling",
        "slot": "weapon",
        "icon": "👻",
        "rarity": "legendary",
        "minIlvl": 20,
        "dropWeight": 0.8,
        "description": "Fire rate doubles when below 30% HP. +50% crit damage.",
        "fixedStats": {
          "damage": 12,
          "fireRate": 18,
          "critDamage": 50,
          "lowHPFireRateMult": 2,
          "lowHPThreshold": 30
        },
        "flavor": "Fear makes the gun faster."
      },
      "mothership_cannon": {
        "name": "Mothership Main Gun",
        "slot": "weapon",
        "icon": "💥",
        "rarity": "mythic",
        "minIlvl": 40,
        "dropWeight": 0.15,
        "bossOnly": true,
        "bossPool": [
          "harbinger"
        ],
        "description": "Massive beam hits all enemies in a line. +60% dmg, -40% fire rate.",
        "fixedStats": {
          "damage": 55,
          "fireRate": -40,
          "beamWidth": 40,
          "beamLength": 800,
          "beamHitsAll": true
        },
        "flavor": "Stripped from the Harbinger's bridge."
      }
    },
    "shields": {
      "aegis_of_eternity": {
        "name": "Aegis of Eternity",
        "slot": "shield",
        "icon": "🛡️",
        "rarity": "legendary",
        "minIlvl": 15,
        "dropWeight": 1,
        "description": "Shield regenerates 3× faster. Taking fatal damage restores 25% shield (60s cooldown).",
        "fixedStats": {
          "shieldCap": 80,
          "shieldRegenMult": 3,
          "fatalSave": true,
          "fatalSavePercent": 25,
          "fatalSaveCooldown": 60
        },
        "flavor": "Time bends around the worthy."
      },
      "null_barrier": {
        "name": "Null Barrier",
        "slot": "shield",
        "icon": "⬛",
        "rarity": "mythic",
        "minIlvl": 35,
        "dropWeight": 0.25,
        "description": "Absorb projectiles to charge. At full charge, release a damage nova. +120 shield.",
        "fixedStats": {
          "shieldCap": 120,
          "absorbCharge": true,
          "chargeNovaRadius": 250,
          "chargeNovaDamage": 200
        },
        "flavor": "What they throw at you becomes your weapon."
      }
    },
    "engines": {
      "warp_drive_mk9": {
        "name": "Warp Drive Mk.IX",
        "slot": "engine",
        "icon": "⚡",
        "rarity": "legendary",
        "minIlvl": 10,
        "dropWeight": 1.2,
        "description": "+45% speed. Leaves a damage trail that hurts enemies.",
        "fixedStats": {
          "speed": 45,
          "damageTrail": true,
          "trailDPS": 15,
          "trailWidth": 30
        },
        "flavor": "The fastest ship in the sector... and the deadliest contrail."
      },
      "quantum_blink": {
        "name": "Quantum Blink Engine",
        "slot": "engine",
        "icon": "💫",
        "rarity": "mythic",
        "minIlvl": 25,
        "dropWeight": 0.35,
        "description": "Dash makes you invulnerable for 0.5s. +30% speed, +10% dodge.",
        "fixedStats": {
          "speed": 30,
          "dodgeChance": 10,
          "dashInvuln": true,
          "dashInvulnDuration": 0.5
        },
        "flavor": "You were here. Now you're not."
      }
    },
    "reactors": {
      "fusion_heart": {
        "name": "Fusion Heart",
        "slot": "reactor",
        "icon": "💎",
        "rarity": "legendary",
        "minIlvl": 15,
        "dropWeight": 1,
        "description": "All damage +20%. Energy regen +30%. Overheats for 2s every 15s (no firing).",
        "fixedStats": {
          "damageMult": 20,
          "energyRegen": 30,
          "overheatCycle": 15,
          "overheatDuration": 2
        },
        "flavor": "Infinite power has infinite consequences."
      },
      "dark_matter_core": {
        "name": "Dark Matter Core",
        "slot": "reactor",
        "icon": "🔮",
        "rarity": "mythic",
        "minIlvl": 40,
        "dropWeight": 0.2,
        "description": "Enemies within 200px take 5% max HP/sec. You take 1% max HP/sec. +40% damage.",
        "fixedStats": {
          "damageMult": 40,
          "proximityAura": true,
          "auraRadius": 200,
          "auraDPSPercent": 5,
          "selfDPSPercent": 1
        },
        "flavor": "The abyss gives freely. It also takes."
      }
    },
    "drones": {
      "swarm_commander": {
        "name": "Swarm Commander",
        "slot": "drone",
        "icon": "🐝",
        "rarity": "legendary",
        "minIlvl": 20,
        "dropWeight": 0.8,
        "description": "Spawns 3 mini-drones that orbit and fire. Each does 25% of your damage.",
        "fixedStats": {
          "droneCount": 3,
          "droneDamagePct": 25,
          "droneOrbitRadius": 120
        },
        "flavor": "The hive follows."
      },
      "sentinel_prime": {
        "name": "Sentinel Prime",
        "slot": "drone",
        "icon": "🤖",
        "rarity": "mythic",
        "minIlvl": 30,
        "dropWeight": 0.3,
        "description": "AI drone that targets the strongest enemy. Crit chance 30%. Heals you 2% per kill.",
        "fixedStats": {
          "droneDamagePct": 60,
          "droneCritChance": 30,
          "droneTargeting": "strongest",
          "droneHealOnKill": 2
        },
        "flavor": "Loyalty beyond programming."
      }
    },
    "modules": {
      "lucky_star_chip": {
        "name": "Lucky Star Chip",
        "slot": "module",
        "icon": "🍀",
        "rarity": "legendary",
        "minIlvl": 10,
        "dropWeight": 1.2,
        "description": "+25 luck. Rarity floor raised to Uncommon. +15% scrap bonus.",
        "fixedStats": {
          "luck": 25,
          "rarityFloor": "uncommon",
          "scrapBonus": 15
        },
        "flavor": "Fortune favors the prepared... and the chippy."
      },
      "berserker_matrix": {
        "name": "Berserker Matrix",
        "slot": "module",
        "icon": "🔥",
        "rarity": "legendary",
        "minIlvl": 20,
        "dropWeight": 0.9,
        "description": "Damage scales with missing HP: up to +80% at 1 HP. -20% max shield.",
        "fixedStats": {
          "berserkMaxBonus": 80,
          "shieldCap": -20
        },
        "flavor": "Pain is the ultimate amplifier."
      },
      "temporal_loop": {
        "name": "Temporal Loop",
        "slot": "module",
        "icon": "⏳",
        "rarity": "mythic",
        "minIlvl": 35,
        "dropWeight": 0.2,
        "description": "On death, rewind 5 seconds (once per zone). +10% to all stats.",
        "fixedStats": {
          "deathRewind": true,
          "rewindSeconds": 5,
          "rewindUsesPerZone": 1,
          "allStatBonus": 10
        },
        "flavor": "This already happened. Or hasn't yet."
      },
      "infinity_chip": {
        "name": "Infinity Chip",
        "slot": "module",
        "icon": "♾️",
        "rarity": "mythic",
        "minIlvl": 50,
        "minDepth": 500,
        "dropWeight": 0.08,
        "description": "All stats +15%. XP +30%. Item drops +1 rarity tier.",
        "fixedStats": {
          "allStatBonus": 15,
          "xpMult": 30,
          "rarityUpgrade": 1
        },
        "flavor": "The final optimization."
      }
    },
    "sets": {
      "void_walker": {
        "name": "Void Walker Set",
        "icon": "🌌",
        "pieces": {
          "void_walker_cannon": {
            "name": "Void Walker Cannon",
            "slot": "weapon",
            "rarity": "legendary",
            "minIlvl": 20,
            "dropWeight": 0.6,
            "description": "Fires void-infused bolts. +20% damage, +1 pierce.",
            "fixedStats": {
              "damage": 25,
              "piercing": 1,
              "damageMult": 20
            }
          },
          "void_walker_shield": {
            "name": "Void Walker Barrier",
            "slot": "shield",
            "rarity": "legendary",
            "minIlvl": 20,
            "dropWeight": 0.6,
            "description": "Shield absorbs void energy. +60 shield, +15% regen.",
            "fixedStats": {
              "shieldCap": 60,
              "shieldRegenMult": 1.15
            }
          },
          "void_walker_core": {
            "name": "Void Walker Core",
            "slot": "reactor",
            "rarity": "legendary",
            "minIlvl": 20,
            "dropWeight": 0.6,
            "description": "Void energy fuels the ship. +15% all damage, +50 HP.",
            "fixedStats": {
              "damageMult": 15,
              "hpBonus": 50
            }
          }
        },
        "bonuses": {
          "2": {
            "label": "Void Resonance",
            "description": "+25% damage to enemies within 150px",
            "stats": {
              "proximityDamageBonus": 25,
              "proximityRange": 150
            }
          },
          "3": {
            "label": "Void Mastery",
            "description": "+40% all damage. Kills explode for AoE.",
            "stats": {
              "damageMult": 40,
              "killExplosion": true,
              "killExplosionRadius": 80,
              "killExplosionDamagePct": 100
            }
          }
        }
      },
      "chrono_pilot": {
        "name": "Chrono Pilot Set",
        "icon": "⏱️",
        "pieces": {
          "chrono_gatling": {
            "name": "Chrono Gatling",
            "slot": "weapon",
            "rarity": "legendary",
            "minIlvl": 25,
            "dropWeight": 0.5,
            "description": "Fire rate ramps in combat (up to +50%).",
            "fixedStats": {
              "damage": 14,
              "fireRate": 15,
              "fireRateRampPerSec": 2,
              "fireRateRampCap": 50
            }
          },
          "chrono_engine": {
            "name": "Chrono Drive",
            "slot": "engine",
            "rarity": "legendary",
            "minIlvl": 25,
            "dropWeight": 0.5,
            "description": "Speed ramps over 3s. +35% max speed, +8% dodge.",
            "fixedStats": {
              "speed": 35,
              "dodgeChance": 8,
              "speedRampTime": 3
            }
          },
          "chrono_module": {
            "name": "Chrono Matrix",
            "slot": "module",
            "rarity": "legendary",
            "minIlvl": 25,
            "dropWeight": 0.5,
            "description": "Cooldowns reduce 1%/s in combat (max 30%).",
            "fixedStats": {
              "cooldownReductionPerSec": 1,
              "cooldownReductionCap": 30
            }
          }
        },
        "bonuses": {
          "2": {
            "label": "Time Dilation",
            "description": "After 10s: +20% fire rate, +15% speed.",
            "stats": {
              "combatRampFireRate": 20,
              "combatRampSpeed": 15,
              "combatRampDelay": 10
            }
          },
          "3": {
            "label": "Temporal Overdrive",
            "description": "Every 30s: 5s double fire rate + invuln.",
            "stats": {
              "overdriveInterval": 30,
              "overdriveDuration": 5,
              "overdriveFireRateMult": 2,
              "overdriveInvuln": true
            }
          }
        }
      }
    }
  }
};
export default EmbeddedData;
