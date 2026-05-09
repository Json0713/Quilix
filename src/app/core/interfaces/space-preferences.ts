export interface SpacePreferences {
    layoutMode: 'card' | 'icon';
    iconSize: 'sm' | 'md' | 'lg';
    borderRadius: 'rounded' | 'squircle' | 'circle' | 'square';
}

export const DEFAULT_SPACE_PREFERENCES: SpacePreferences = {
    layoutMode: 'icon',
    iconSize: 'sm',
    borderRadius: 'square'
};
