export const TREE_SPECIES = [
  { id: 'oak', name: 'Oak', emoji: '🌳', shape: 'round', leafColor: '#3d8b3d', leafDark: '#2a6b2a', trunkColor: '#6d4c41', description: 'Steadfast and timeless. Grows slowly but lives forever.' },
  { id: 'cherry_blossom', name: 'Cherry Blossom', emoji: '🌸', shape: 'fan', leafColor: '#ffb7c5', leafDark: '#f48fb1', trunkColor: '#6d4c41', description: 'Beautiful and fleeting. Blooms brightest after hardship.' },
  { id: 'pine', name: 'Pine', emoji: '🌲', shape: 'upright', leafColor: '#2d6a27', leafDark: '#1b4a17', trunkColor: '#5d4037', description: 'Evergreen and resilient. Never loses its color.' },
  { id: 'willow', name: 'Willow', emoji: '🌿', shape: 'drooping', leafColor: '#5aaa3a', leafDark: '#3a8a1a', trunkColor: '#795548', description: 'Graceful and flowing. Bends but never breaks.' },
  { id: 'maple', name: 'Maple', emoji: '🍁', shape: 'round', leafColor: '#c0392b', leafDark: '#922b21', trunkColor: '#5d4037', description: 'Bold and transformative. Shows its true colors in time.' },
  { id: 'baobab', name: 'Baobab', emoji: '🌍', shape: 'baobab', leafColor: '#388e3c', leafDark: '#1b5e20', trunkColor: '#8d6e63', description: 'Ancient and enduring. Survives where others cannot.' },
  { id: 'avocado', name: 'Avocado', emoji: '🥑', shape: 'avocado', leafColor: '#4a7c2f', leafDark: '#2d5a1a', trunkColor: '#6d4c41', description: 'Lush and nourishing. Worth the wait.' },
  { id: 'bonsai', name: 'Bonsai', emoji: '🎋', shape: 'bonsai', leafColor: '#43a047', leafDark: '#2e7d32', trunkColor: '#4e342e', description: 'Patient and refined. Beauty through discipline.' },
  { id: 'palm', name: 'Palm Tree', emoji: '🌴', shape: 'palm', leafColor: '#4caf50', leafDark: '#2e7d32', trunkColor: '#bcaaa4', description: 'Free and tropical. Thrives in the sunshine.' },
  { id: 'cactus', name: 'Cactus', emoji: '🌵', shape: 'cactus', leafColor: '#4caf50', leafDark: '#388e3c', trunkColor: '#4caf50', description: 'Tough and resourceful. Thrives where others wither.' },
  { id: 'apple', name: 'Apple Tree', emoji: '🍎', shape: 'round', leafColor: '#388e3c', leafDark: '#1b5e20', trunkColor: '#5d4037', description: 'Fruitful and giving. Rewards patience.' },
  { id: 'lemon', name: 'Lemon Tree', emoji: '🍋', shape: 'round', leafColor: '#558b2f', leafDark: '#33691e', trunkColor: '#6d4c41', description: 'Bright and zesty. Makes the best of any situation.' },
  { id: 'banana', name: 'Banana Tree', emoji: '🍌', shape: 'palm', leafColor: '#33691e', leafDark: '#1b5e20', trunkColor: '#8bc34a', description: 'Bold and tropical. Grows fast and strong.' },
  { id: 'redwood', name: 'Redwood', emoji: '🏔️', shape: 'upright', leafColor: '#1b5e20', leafDark: '#0a2e0a', trunkColor: '#4e342e', description: 'Towering and majestic. Among the tallest of all.' },
  { id: 'bamboo', name: 'Bamboo', emoji: '🎍', shape: 'bamboo', leafColor: '#8bc34a', leafDark: '#558b2f', trunkColor: '#8bc34a', description: 'Flexible and fast-growing. Strength through flexibility.' },
  { id: 'olive', name: 'Olive Tree', emoji: '🫒', shape: 'round', leafColor: '#9ccc65', leafDark: '#7cb342', trunkColor: '#795548', description: 'Peaceful and ancient. Symbol of wisdom and victory.' },
  { id: 'mango', name: 'Mango Tree', emoji: '🥭', shape: 'round', leafColor: '#2e7d32', leafDark: '#1b5e20', trunkColor: '#5d4037', description: 'Sweet and abundant. Life is good under its shade.' },
  { id: 'weeping_willow', name: 'Weeping Willow', emoji: '🌾', shape: 'drooping', leafColor: '#81c784', leafDark: '#4caf50', trunkColor: '#795548', description: 'Serene and reflective. Finds beauty in melancholy.' },
  { id: 'rainbow_eucalyptus', name: 'Rainbow Eucalyptus', emoji: '🌈', shape: 'round', leafColor: '#26a69a', leafDark: '#00796b', trunkColor: 'rainbow', description: 'Rare and spectacular. Unlike anything else in nature.' },
  { id: 'dragon_blood', name: 'Dragon Blood Tree', emoji: '🔮', shape: 'fan', leafColor: '#004d40', leafDark: '#002d25', trunkColor: '#795548', description: 'Mysterious and ancient. From another world entirely.' },
];

export const CHARACTER_ARCHETYPES = [
  { id: 'warrior', name: 'Warrior', emoji: '⚔️', group: 'fighter', description: 'Battle-hardened and fierce', primaryColor: '#c62828' },
  { id: 'wizard', name: 'Wizard', emoji: '🧙', group: 'mage', description: 'Wielder of arcane powers', primaryColor: '#6a1b9a' },
  { id: 'knight', name: 'Knight', emoji: '🏰', group: 'fighter', description: 'Noble and honorable protector', primaryColor: '#1565c0' },
  { id: 'archer', name: 'Archer', emoji: '🏹', group: 'ranger', description: 'Swift and precise hunter', primaryColor: '#2e7d32' },
  { id: 'monk', name: 'Monk', emoji: '🧘', group: 'monk_type', description: 'Serene and disciplined master', primaryColor: '#f57f17' },
  { id: 'bodybuilder', name: 'Bodybuilder', emoji: '💪', group: 'monk_type', description: 'Peak physical perfection', primaryColor: '#e65100' },
  { id: 'athlete', name: 'Athlete', emoji: '🏆', group: 'athlete', description: 'Driven competitor at their prime', primaryColor: '#00838f' },
  { id: 'ninja', name: 'Ninja', emoji: '🥷', group: 'stealth', description: 'Shadow operative, unseen force', primaryColor: '#212121' },
  { id: 'samurai', name: 'Samurai', emoji: '⛩️', group: 'fighter', description: 'Disciplined warrior of honor', primaryColor: '#b71c1c' },
  { id: 'viking', name: 'Viking', emoji: '🪓', group: 'fighter', description: 'Fearless Norse raider', primaryColor: '#4e342e' },
  { id: 'pirate', name: 'Pirate', emoji: '🏴‍☠️', group: 'stealth', description: 'Free spirit of the high seas', primaryColor: '#37474f' },
  { id: 'explorer', name: 'Explorer', emoji: '🧭', group: 'ranger', description: 'Curious discoverer of worlds', primaryColor: '#5d4037' },
  { id: 'scientist', name: 'Scientist', emoji: '🔬', group: 'creative', description: 'Seeker of truth and knowledge', primaryColor: '#0277bd' },
  { id: 'artist', name: 'Artist', emoji: '🎨', group: 'creative', description: 'Creative visionary and dreamer', primaryColor: '#d81b60' },
  { id: 'chef', name: 'Chef', emoji: '👨‍🍳', group: 'creative', description: 'Master of flavors and craft', primaryColor: '#ef6c00' },
  { id: 'astronaut', name: 'Astronaut', emoji: '🚀', group: 'hero', description: 'Explorer of the final frontier', primaryColor: '#1a237e' },
  { id: 'superhero', name: 'Superhero', emoji: '🦸', group: 'hero', description: 'Defender of justice and light', primaryColor: '#b71c1c' },
  { id: 'rockstar', name: 'Rockstar', emoji: '🎸', group: 'athlete', description: 'Legend of the stage', primaryColor: '#880e4f' },
  { id: 'dancer', name: 'Dancer', emoji: '💃', group: 'athlete', description: 'Graceful artist in motion', primaryColor: '#ad1457' },
  { id: 'alchemist', name: 'Alchemist', emoji: '⚗️', group: 'mage', description: 'Transformer of the impossible', primaryColor: '#4a148c' },
];

export const SKIN_TONES = [
  { id: 'tone1', name: 'Porcelain', color: '#FDDBB4', shadow: '#E8C49A', lip: '#E9967A' },
  { id: 'tone2', name: 'Ivory', color: '#F1C27D', shadow: '#D4A863', lip: '#D2855A' },
  { id: 'tone3', name: 'Warm', color: '#C68642', shadow: '#A6703C', lip: '#A05030' },
  { id: 'tone4', name: 'Caramel', color: '#8D5524', shadow: '#6D4019', lip: '#6D3015' },
  { id: 'tone5', name: 'Espresso', color: '#5C3317', shadow: '#3D1F0C', lip: '#3D1505' },
  { id: 'tone6', name: 'Ebony', color: '#3B1D08', shadow: '#231006', lip: '#231006' },
];

export const HAIR_COLORS = [
  { id: 'black', name: 'Black', color: '#1a1a1a' },
  { id: 'dark_brown', name: 'Dark Brown', color: '#3b1f0d' },
  { id: 'brown', name: 'Brown', color: '#6b3a2a' },
  { id: 'light_brown', name: 'Light Brown', color: '#9c6b3c' },
  { id: 'auburn', name: 'Auburn', color: '#8b3a1e' },
  { id: 'red', name: 'Red', color: '#c0392b' },
  { id: 'strawberry', name: 'Strawberry', color: '#d4875e' },
  { id: 'blonde', name: 'Blonde', color: '#f0c040' },
  { id: 'platinum', name: 'Platinum', color: '#e8e0c0' },
  { id: 'white', name: 'White', color: '#f5f5f5' },
  { id: 'gray', name: 'Gray', color: '#9e9e9e' },
  { id: 'blue', name: 'Electric Blue', color: '#1565c0' },
  { id: 'purple', name: 'Violet', color: '#7b1fa2' },
  { id: 'pink', name: 'Hot Pink', color: '#e91e63' },
  { id: 'green', name: 'Emerald', color: '#2e7d32' },
  { id: 'teal', name: 'Teal', color: '#00838f' },
  { id: 'rainbow', name: 'Rainbow', color: 'rainbow' },
];

export const HAIR_STYLES = [
  { id: 'short', name: 'Short Crop' },
  { id: 'medium', name: 'Medium Wave' },
  { id: 'long', name: 'Long Straight' },
  { id: 'curly', name: 'Curly' },
  { id: 'afro', name: 'Afro' },
  { id: 'braids', name: 'Braids' },
  { id: 'mohawk', name: 'Mohawk' },
  { id: 'undercut', name: 'Undercut' },
  { id: 'bun', name: 'Top Bun' },
  { id: 'ponytail', name: 'Ponytail' },
  { id: 'pigtails', name: 'Pigtails' },
  { id: 'dreadlocks', name: 'Dreadlocks' },
  { id: 'buzz', name: 'Buzz Cut' },
  { id: 'bald', name: 'Bald' },
  { id: 'shaved_sides', name: 'Shaved Sides' },
  { id: 'quiff', name: 'Quiff' },
];

export const EYE_COLORS = [
  { id: 'brown', name: 'Brown', color: '#5d4037' },
  { id: 'dark_brown', name: 'Dark Brown', color: '#3e2723' },
  { id: 'hazel', name: 'Hazel', color: '#8d6e63' },
  { id: 'green', name: 'Green', color: '#388e3c' },
  { id: 'blue', name: 'Blue', color: '#1565c0' },
  { id: 'gray', name: 'Gray', color: '#607d8b' },
  { id: 'amber', name: 'Amber', color: '#f57f17' },
  { id: 'violet', name: 'Violet', color: '#7b1fa2' },
  { id: 'teal', name: 'Teal', color: '#00838f' },
  { id: 'red', name: 'Red', color: '#c62828' },
  { id: 'heterochromia', name: 'Heterochromia', color: '#1565c0', rightColor: '#388e3c' },
];

export const BODY_TYPES = [
  { id: 'slim', name: 'Slim', sw: 0.82, hw: 0.78, ww: 0.72, lw: 0.82, hs: 0.97 },
  { id: 'average', name: 'Average', sw: 1.0, hw: 1.0, ww: 0.88, lw: 1.0, hs: 1.0 },
  { id: 'athletic', name: 'Athletic', sw: 1.15, hw: 0.95, ww: 0.82, lw: 1.07, hs: 1.0 },
  { id: 'stocky', name: 'Stocky', sw: 1.1, hw: 1.12, ww: 1.02, lw: 1.12, hs: 0.97 },
  { id: 'curvy', name: 'Curvy', sw: 1.0, hw: 1.22, ww: 0.82, lw: 1.05, hs: 1.0 },
  { id: 'muscular', name: 'Muscular', sw: 1.32, hw: 1.05, ww: 0.92, lw: 1.25, hs: 1.0 },
];

export const GENDER_OPTIONS = [
  { id: 'masculine', name: 'Masculine' },
  { id: 'feminine', name: 'Feminine' },
  { id: 'androgynous', name: 'Androgynous' },
];

export const POT_STYLES = [
  { id: 'terracotta', name: 'Terracotta', color: '#bf5a2c', rim: '#d4703a', dark: '#a64e24' },
  { id: 'ceramic', name: 'Ceramic', color: '#e8e0d0', rim: '#f0ead8', dark: '#d0c8b8' },
  { id: 'wooden_barrel', name: 'Wooden Barrel', color: '#8d6e63', rim: '#a0877c', dark: '#795548' },
  { id: 'stone', name: 'Stone', color: '#9e9e9e', rim: '#bdbdbd', dark: '#757575' },
  { id: 'floating', name: 'Floating', color: '#4a4a4a', rim: '#5a5a5a', dark: '#3a3a3a' },
];

export const DECORATIONS = [
  { id: 'none', name: 'None' },
  { id: 'fairy_lights', name: 'Fairy Lights' },
  { id: 'tire_swing', name: 'Tire Swing' },
  { id: 'treehouse', name: 'Treehouse' },
  { id: 'birds_nest', name: "Bird's Nest" },
  { id: 'hammock', name: 'Hammock' },
];

export const BACKGROUNDS = [
  { id: 'day', name: 'Sunny Day', sky1: '#87CEEB', sky2: '#c8e6c9', ground: '#7cb67c' },
  { id: 'sunset', name: 'Sunset', sky1: '#e84c0d', sky2: '#ffa040', ground: '#8d6e63' },
  { id: 'night_stars', name: 'Night Stars', sky1: '#0d1b4b', sky2: '#1a237e', ground: '#1b5e20' },
  { id: 'rainy', name: 'Rainy Day', sky1: '#607d8b', sky2: '#b0bec5', ground: '#558b6e' },
  { id: 'snowy', name: 'Snowy', sky1: '#e3f2fd', sky2: '#b3e5fc', ground: '#ffffff' },
  { id: 'mystical_forest', name: 'Mystical Forest', sky1: '#1b2838', sky2: '#2e3d2f', ground: '#1b4a2a' },
  { id: 'tropical_beach', name: 'Tropical Beach', sky1: '#00b4d8', sky2: '#90e0ef', ground: '#f9c74f' },
  { id: 'mountaintop', name: 'Mountaintop', sky1: '#5b86c0', sky2: '#9ec8e8', ground: '#9e9e9e' },
  { id: 'space', name: 'Space', sky1: '#000000', sky2: '#0a0a2a', ground: '#1a1a2e' },
];

export function getLevelTier(level) {
  if (level >= 20) return 'legendary';
  if (level >= 11) return 'advanced';
  if (level >= 6) return 'intermediate';
  return 'basic';
}

export function getDefaultState(type) {
  if (type === 'tree') {
    return {
      species: 'oak',
      potStyle: 'terracotta',
      decoration: 'none',
      background: 'day',
      name: 'My Tree',
    };
  }
  return {
    archetype: 'warrior',
    gender: 'masculine',
    skinTone: 'tone2',
    hairColor: 'black',
    hairStyle: 'short',
    eyeColor: 'brown',
    beard: false,
    freckles: false,
    glasses: false,
    bodyType: 'average',
    outfitColor: '#c62828',
    background: 'day',
    name: 'My Hero',
  };
}
