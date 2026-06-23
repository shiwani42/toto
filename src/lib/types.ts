export type Product = {
  product_code: string;
  product_id: string;
  name: string;
  brand: string;
  category: string;
  color: string;
  size: string;
  price_chf: number;
  discount_pct: number;
  weight_g: number;
  waterproof_rating_mm: number;
  temp_rating_c: number | null;
  material: string;
  tags: string[];
  zone: string;
  zone_name: string;
  aisle: string;
  stock_total: number;
  stock_front: number;
  description: string;
};

export type Screen =
  | "home"
  | "list"
  | "map"
  | "scan"
  | "done"
  | "smoke"
  | "plan"
  | "browse"
  | "compare"
  | "repair"
  | "connect"
  | "connected"
  | "settings"
  | "fit"
  | "admin"
  | "shop-onboarding"
  | "nearby";
