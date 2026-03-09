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
export const INTERACTION_FACING_THRESHOLD = 0.5;
export const HIGHLIGHT_EMISSIVE = 0x444444;

export const SMOKE_POOL_SIZE = 80;
export const SMOKE_PARTICLE_LIFETIME = 0.4;
export const SMOKE_SPAWN_INTERVAL = 0.05;
export const SMOKE_COLOR = 0xffffff;
export const SMOKE_DASH_ARC_COUNT = 9;
export const SMOKE_DASH_ARC_ANGLE = 2.8;

export const AUDIO_TRACK_FADE_MS = 100;

// Order system
export const ORDER_BASE_POINTS = 20;
export const ORDER_DURATION_MS = 60_000;
export const ORDER_GREEN_THRESHOLD = 0.4;
export const ORDER_YELLOW_THRESHOLD = 0.7;
export const ORDER_GREEN_TIP = 8;
export const ORDER_YELLOW_TIP = 4;
export const ORDER_RED_TIP = 0;
export const ORDER_EXPIRE_PENALTY = -10;
export const ORDER_MAX_ACTIVE = 4;
export const ORDER_SPAWN_MIN_MS = 15_000;
export const ORDER_SPAWN_MAX_MS = 20_000;
export const ORDER_FIRST_DELAY_MS = 3_000;
export const ORDER_MIN_ACTIVE = 1;

// Combo
export const COMBO_MAX_MULTIPLIER = 4;

// Star rating
export const STAR_THRESHOLDS = [80, 200, 400];

export const LIGHT_COLOR = '#ffffff';

export const BLOOM_LAYER = 1;

export const LEADERBOARD_REFRESH_MS = 60_000;

// Camera
export const CAMERA_DEFAULT_FOV = 35;
export const CAMERA_SMOOTH_TIME = 0.6; // s, exponential smoothing time constant
export const CAMERA_PAN_MARGIN = 0.02; // fraction of viewport per side
export const CAMERA_ZOOM_STRENGTH = 0.02; // max FOV change fraction
