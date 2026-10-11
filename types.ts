export interface Location {
  url: string;
  title: string;
}

export interface Photo {
  file: string;
  title: string;
  version?: string;
  favourite?: boolean;
  width?: number;
  height?: number;
  // per-button url override; an empty string hides that button
  links?: Record<string, string>;
}

// config.json
export interface Button {
  id: string;
  label?: string;
  urlTemplate?: string;
  icon?: string;
}

export interface Config {
  assetsDir?: string;
  buttons?: Button[];
}
