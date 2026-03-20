export const COLORS = {
  white: '#ffffff',
  mindaro: '#e2f77e',
  night: '#121016',
  'lilac-2': '#F9F7FC',
  'lilac-1': '#D9D1E5',
  lilac: '#CDB4F2',
  'lilac+1': '#605473',
  'lilac+2': '#2A2433',
};

export const BACKGROUND_COLOR = COLORS.mindaro;
export const BACKGROUND_COLOR_R = '226';
export const BACKGROUND_COLOR_G = '247';
export const BACKGROUND_COLOR_B = '126';

export const TILE_SIZE = 2;
export const MOVEMENT_SPEED = 10;
export const DASH_SPEED = 25;
export const DASH_DURATION = 0.2;
export const DASH_COOLDOWN = 0.5;

export const INTERACTION_DISTANCE = 1.4;
export const INTERACTION_FACING_THRESHOLD = 0; // dot-product threshold; object interactable when dot ≥ this (0 = full front 180° arc; negative = player showing back)

export const SMOKE_POOL_SIZE = 80;
export const SMOKE_PARTICLE_LIFETIME = 0.4;
export const SMOKE_SPAWN_INTERVAL = 0.05;
export const SMOKE_COLOR = 0xffffff;
export const SMOKE_DASH_ARC_COUNT = 9;
export const SMOKE_DASH_ARC_ANGLE = 2.8;

export const AUDIO_TRACK_FADE_MS = 100;
export const MENU_TRACK_LOOP_DELAY_MS = 3000;

// Delivery animation
export const DELIVERY_ANIM_DURATION = 0.5; // s — package visible before smoke vanish
export const DELIVERY_SMOKE_COUNT = 12; // particles spawned on vanish

// Assembly
export const ASSEMBLE_HOLD_DURATION = 15_000; // ms

// Progress bars
export const PROGRESS_BAR_FILL_COLOR = 0x00ff00;

// Order system
export const ORDER_BASE_POINTS = 20;
export const ORDER_DURATION_MS = 95_000;
export const ORDER_GREEN_THRESHOLD = 0.4; // HUD visual only
export const ORDER_YELLOW_THRESHOLD = 0.7; // HUD visual only
export const ORDER_GREEN_TIP = 8; // HUD visual only
export const ORDER_YELLOW_TIP = 4; // HUD visual only
export const ORDER_RED_TIP = 0; // HUD visual only
export const ORDER_EXPIRE_PENALTY = -20;
export const ORDER_SPAWN_INTERVAL_MS = 10_000;
export const ORDER_INITIAL_BURST = 2;
export const ORDER_MAX_ACTIVE = 7;
export const ORDER_MIN_ACTIVE = 1;

// Combo
export const COMBO_MAX_MULTIPLIER = 4;

// Star rating
export const STAR_THRESHOLDS = [80, 200, 400];

export const LIGHT_COLOR = '#ffffff';

export const BLOOM_LAYER = 1;
// Meshes on this layer act as opaque occluders during the bloom pass so neon
// glow cannot composite over them, while still rendering normally (depthTest:false,
// renderOrder:999) in the final pass.
export const OVERLAY_LAYER = 2;

export const LEADERBOARD_REFRESH_MS = 60_000;
export const LEADERBOARD_LIMIT = 15;

// Camera
export const CAMERA_DEFAULT_FOV = 35;
export const CAMERA_SMOOTH_TIME = 0.6; // s, exponential smoothing time constant
export const CAMERA_PAN_MARGIN = 0.02; // fraction of viewport per side
export const CAMERA_ZOOM_STRENGTH = 0.02; // max FOV change fraction
