import { MenuCategory, MenuItem, RestaurantTable, Combo, StaffProfile, MenuItemAddon } from '../types';

export const INITIAL_CATEGORIES: MenuCategory[] = [
  { id: 'cat-chicken-biryani', name: '[DEMO DATA] Chicken Biryani', sort_order: 1, is_active: true },
  { id: 'cat-mutton-biryani', name: '[DEMO DATA] Mutton Biryani', sort_order: 2, is_active: true },
  { id: 'cat-veg-biryani', name: '[DEMO DATA] Veg Biryani', sort_order: 3, is_active: true },
  { id: 'cat-starters', name: '[DEMO DATA] Starters', sort_order: 4, is_active: true },
  { id: 'cat-kebabs', name: '[DEMO DATA] Kebabs', sort_order: 5, is_active: true },
  { id: 'cat-meals', name: '[DEMO DATA] South Indian Meals', sort_order: 6, is_active: true },
  { id: 'cat-beverages', name: '[DEMO DATA] Beverages', sort_order: 7, is_active: true },
  { id: 'cat-desserts', name: '[DEMO DATA] Desserts', sort_order: 8, is_active: true },
];

export const INITIAL_ADDONS: MenuItemAddon[] = [
  { id: 'addon-salan', name: 'Extra Mirchi Ka Salan', price_paise: 2000, is_available: true, sort_order: 1 },
  { id: 'addon-raita', name: 'Extra Onion & Mint Raita', price_paise: 2000, is_available: true, sort_order: 2 },
  { id: 'addon-egg', name: 'Boiled Egg (1 pc)', price_paise: 1500, is_available: true, sort_order: 3 },
  { id: 'addon-ghee', name: 'Extra Desi Ghee Topping', price_paise: 2500, is_available: true, sort_order: 4 },
  { id: 'addon-mild', name: 'Mild / Low Spice', price_paise: 0, is_available: true, sort_order: 5 },
  { id: 'addon-spicy', name: 'Extra Spicy Masala', price_paise: 0, is_available: true, sort_order: 6 },
];

export const INITIAL_ITEMS: MenuItem[] = [
  // 1. Chicken Biryani
  {
    id: 'item-chicken-dum-biryani',
    category_id: 'cat-chicken-biryani',
    name: 'Chicken Dum Biryani',
    description: '[DEMO DATA] Slow-cooked fragrant basmati rice layered with succulent bone-in chicken marinated in saffron, curd, and hand-ground spices.',
    price_paise: 22000,
    dietary: 'non_veg',
    is_available: true,
    sort_order: 1,
    image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
    addons: INITIAL_ADDONS,
  },
  {
    id: 'item-boneless-chicken-biryani',
    category_id: 'cat-chicken-biryani',
    name: 'Boneless Chicken Biryani',
    description: '[DEMO DATA] Tender, juicy boneless chicken morsels cooked in rich dum masala and sealed with ghee-steamed long-grain rice.',
    price_paise: 26000,
    dietary: 'non_veg',
    is_available: true,
    sort_order: 2,
    image_url: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600&auto=format&fit=crop&q=80',
    addons: INITIAL_ADDONS,
  },

  // 2. Mutton Biryani
  {
    id: 'item-mutton-dum-biryani',
    category_id: 'cat-mutton-biryani',
    name: 'Mutton Dum Biryani',
    description: '[DEMO DATA] Tender pasture-fed local mutton marinated overnight in crushed spices, slow dum cooked to perfection with basmati rice.',
    price_paise: 32000,
    dietary: 'non_veg',
    is_available: true,
    sort_order: 1,
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80',
    addons: INITIAL_ADDONS,
  },

  // 3. Veg Biryani
  {
    id: 'item-paneer-biryani',
    category_id: 'cat-veg-biryani',
    name: 'Paneer Biryani',
    description: '[DEMO DATA] Marinated fresh malai paneer cubes gently charred and layered with fragrant spiced rice, mint leaves, and browned onions.',
    price_paise: 19000,
    dietary: 'veg',
    is_available: true,
    sort_order: 1,
    image_url: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=600&auto=format&fit=crop&q=80',
    addons: INITIAL_ADDONS.filter(a => a.id !== 'addon-egg'),
  },
  {
    id: 'item-veg-biryani',
    category_id: 'cat-veg-biryani',
    name: 'Veg Biryani',
    description: '[DEMO DATA] Wholesome assortment of farm vegetables, florets, green peas, and potatoes cooked in fragrant whole spices and herbs.',
    price_paise: 16000,
    dietary: 'veg',
    is_available: true,
    sort_order: 2,
    image_url: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&auto=format&fit=crop&q=80',
    addons: INITIAL_ADDONS.filter(a => a.id !== 'addon-egg'),
  },

  // 4. Starters
  {
    id: 'item-chicken-65',
    category_id: 'cat-starters',
    name: 'Chicken 65',
    description: '[DEMO DATA] Iconic South Indian fried chicken tossed with freshly pounded Byadgi chillies, ginger-garlic paste, and crackling curry leaves.',
    price_paise: 18000,
    dietary: 'non_veg',
    is_available: true,
    sort_order: 1,
    image_url: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'item-chicken-lollipop',
    category_id: 'cat-starters',
    name: 'Chicken Lollipop',
    description: '[DEMO DATA] Spiced batter-coated frenched chicken winglets fried crisp and served with zesty hot garlic sauce (5 pcs).',
    price_paise: 20000,
    dietary: 'non_veg',
    is_available: true,
    sort_order: 2,
    image_url: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=600&auto=format&fit=crop&q=80',
  },

  // 5. South Indian Meals / Curries
  {
    id: 'item-andhra-chicken-curry',
    category_id: 'cat-meals',
    name: 'Andhra Chicken Curry',
    description: '[DEMO DATA] Authentic Rayalaseema-style spicy chicken curry simmered in poppy seeds, roasted coconut, and fresh green chillies.',
    price_paise: 24000,
    dietary: 'non_veg',
    is_available: true,
    sort_order: 1,
    image_url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'item-butter-naan',
    category_id: 'cat-meals',
    name: 'Butter Naan',
    description: '[DEMO DATA] Soft, cloud-like leavened bread baked fresh in the clay tandoor and brushed generously with desi butter.',
    price_paise: 4000,
    dietary: 'veg',
    is_available: true,
    sort_order: 2,
    image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80',
  },

  // 6. Desserts
  {
    id: 'item-gulab-jamun',
    category_id: 'cat-desserts',
    name: 'Gulab Jamun',
    description: '[DEMO DATA] Melt-in-the-mouth golden fried milk dumplings steeped in warm rose and cardamom syrup (2 pcs).',
    price_paise: 6000,
    dietary: 'veg',
    is_available: true,
    sort_order: 1,
    image_url: 'https://images.unsplash.com/photo-1605197154344-933e144a1ebc?w=600&auto=format&fit=crop&q=80',
  },

  // 7. Beverages
  {
    id: 'item-coke',
    category_id: 'cat-beverages',
    name: 'Coke',
    description: '[DEMO DATA] Chilled 300ml Coca-Cola glass bottle served with ice.',
    price_paise: 4000,
    dietary: 'veg',
    is_available: true,
    sort_order: 1,
  },
  {
    id: 'item-buttermilk',
    category_id: 'cat-beverages',
    name: 'Buttermilk',
    description: '[DEMO DATA] Cool freshly churned spiced curd tempered with ginger, mustard seeds, curry leaves, and fresh coriander.',
    price_paise: 3000,
    dietary: 'veg',
    is_available: true,
    sort_order: 2,
  },
];

export const INITIAL_COMBOS: Combo[] = [
  {
    id: 'combo-biryani-feast',
    name: '[DEMO DATA] Biryani Feast Combo',
    description: '[DEMO DATA] 1 Chicken Dum Biryani, 1 Portion Chicken 65, and 1 Chilled Coke',
    price_paise: 39000,
    dietary: 'non_veg',
    is_available: true,
    items: [
      { id: 'item-chicken-dum-biryani', name: 'Chicken Dum Biryani', quantity: 1 },
      { id: 'item-chicken-65', name: 'Chicken 65', quantity: 1 },
      { id: 'item-coke', name: 'Coke', quantity: 1 },
    ],
  },
  {
    id: 'combo-veg-delight',
    name: '[DEMO DATA] Veg Biryani Special Combo',
    description: '[DEMO DATA] 1 Paneer Biryani, 1 Spiced Buttermilk, and 1 Hot Gulab Jamun',
    price_paise: 25000,
    dietary: 'veg',
    is_available: true,
    items: [
      { id: 'item-paneer-biryani', name: 'Paneer Biryani', quantity: 1 },
      { id: 'item-buttermilk', name: 'Buttermilk', quantity: 1 },
      { id: 'item-gulab-jamun', name: 'Gulab Jamun', quantity: 1 },
    ],
  },
];

// 10 Demo Tables T01–T10
export const INITIAL_TABLES: RestaurantTable[] = [
  { id: 'table-01', table_number: 'T01', seat_capacity: 2, active_token: 'qr_demo_t01', status: 'vacant', is_active: true, created_at: new Date().toISOString() },
  { id: 'table-02', table_number: 'T02', seat_capacity: 2, active_token: 'qr_demo_t02', status: 'vacant', is_active: true, created_at: new Date().toISOString() },
  { id: 'table-03', table_number: 'T03', seat_capacity: 4, active_token: 'qr_demo_t03', status: 'occupied', is_active: true, created_at: new Date().toISOString() },
  { id: 'table-04', table_number: 'T04', seat_capacity: 4, active_token: 'qr_demo_t04', status: 'vacant', is_active: true, created_at: new Date().toISOString() },
  { id: 'table-05', table_number: 'T05', seat_capacity: 4, active_token: 'qr_demo_t05', status: 'vacant', is_active: true, created_at: new Date().toISOString() },
  { id: 'table-06', table_number: 'T06', seat_capacity: 6, active_token: 'qr_demo_t06', status: 'vacant', is_active: true, created_at: new Date().toISOString() },
  { id: 'table-07', table_number: 'T07', seat_capacity: 6, active_token: 'qr_demo_t07', status: 'occupied', is_active: true, created_at: new Date().toISOString() },
  { id: 'table-08', table_number: 'T08', seat_capacity: 4, active_token: 'qr_demo_t08', status: 'vacant', is_active: true, created_at: new Date().toISOString() },
  { id: 'table-09', table_number: 'T09', seat_capacity: 4, active_token: 'qr_demo_t09', status: 'vacant', is_active: true, created_at: new Date().toISOString() },
  { id: 'table-10', table_number: 'T10', seat_capacity: 8, active_token: 'qr_demo_t10', status: 'vacant', is_active: true, created_at: new Date().toISOString() },
];

export const INITIAL_STAFF: StaffProfile[] = [
  { id: 'staff-owner', full_name: 'Anand Kumar (Owner)', role: 'owner', active: true, created_at: new Date().toISOString() },
  { id: 'staff-waiter', full_name: 'Ramesh Gowda (Floor Captain)', role: 'waiter', active: true, created_at: new Date().toISOString() },
  { id: 'staff-kitchen', full_name: 'Chef Shivanna (Head Chef)', role: 'kitchen', active: true, created_at: new Date().toISOString() },
];
