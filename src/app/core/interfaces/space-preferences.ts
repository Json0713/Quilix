export interface SpacePreferences {
    layoutMode: 'card' | 'icon';
    iconSize: 'sm' | 'md' | 'lg';
    borderRadius: 'rounded' | 'squircle' | 'circle';
}

export const DEFAULT_SPACE_PREFERENCES: SpacePreferences = {
    layoutMode: 'card',
    iconSize: 'md',
    borderRadius: 'squircle'
};
