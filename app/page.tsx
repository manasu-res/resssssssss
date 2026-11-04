import React from 'react';
import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase/service';
import { dbStore } from '@/lib/data/store';
import { PublicMenuView } from '@/components/public/public-menu-view';

export const dynamic = 'force-dynamic';

async function getHomepageData() {
  const supabase = getServiceSupabase();

  let settings = dbStore.settings;
  let categories: any[] = dbStore.categories;
  let items: any[] = dbStore.items;
  let combos: any[] = dbStore.combos;

  if (supabase) {
    try {
      const { data: setRow } = await (supabase as any)
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (setRow) settings = { ...settings, ...setRow };

      const { data: catRows } = await (supabase as any)
        .from('categories')
        .select('id, name, sort_order')
        .order('sort_order', { ascending: true });
      if (catRows && catRows.length > 0) categories = catRows;

      const { data: itemRows } = await (supabase as any)
        .from('menu_items')
        .select('id, category_id, name, description, price, price_paise, dietary, is_veg, is_available, sort_order')
        .order('sort_order', { ascending: true });
      if (itemRows && itemRows.length > 0) {
        items = itemRows.map((i: any) => ({
          ...i,
          price_paise: i.price ?? i.price_paise ?? 0,
          dietary: i.dietary || (i.is_veg ? 'veg' : 'non_veg'),
        }));
      }

      const { data: comboRows } = await (supabase as any)
        .from('combos')
        .select('id, name, description, price, price_paise, dietary, is_veg, is_available')
        .order('created_at', { ascending: true });

      const { data: comboItemRows } = await (supabase as any)
        .from('combo_items')
        .select('combo_id, quantity, menu_item:menu_items(name)');

      if (comboRows && comboRows.length > 0) {
        combos = comboRows.map((c: any) => ({
          ...c,
          price_paise: c.price ?? c.price_paise ?? 0,
          dietary: c.dietary || (c.is_veg ? 'veg' : 'non_veg'),
          items: (comboItemRows || [])
            .filter((ci: any) => ci.combo_id === c.id)
            .map((ci: any) => ({
              name: ci.menu_item?.name || 'Item',
              quantity: ci.quantity || 1,
            })),
        }));
      }
    } catch (err) {
      console.warn('Supabase homepage fetch fallback:', err);
    }
  }

  return { settings, categories, items, combos };
}

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getHomepageData();
  const name = settings.restaurant_name || 'Manasu Restaurant';
  const tagline = settings.tagline || 'Pure Vegetarian South Indian Cuisine';
  const description =
    settings.about_text ||
    `${name} — ${tagline} in ${settings.address || 'Bengaluru'}. Traditional flavours, authentic ingredients, fresh daily.`;

  return {
    title: `${name} | ${tagline}`,
    description,
    openGraph: {
      title: `${name} | ${tagline}`,
      description,
      type: 'website',
      locale: 'en_IN',
      siteName: name,
    },
  };
}

export default async function HomePage() {
  const { settings, categories, items, combos } = await getHomepageData();

  const name = settings.restaurant_name || 'Manasu Restaurant';
  const tagline = settings.tagline || '';
  const address = settings.address?.trim() || '';
  const phone = settings.phone?.trim() || '';
  const mapsUrl =
    settings.maps_url?.trim() ||
    (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}` : '');
  const openingHours = settings.opening_hours?.trim() || '';
  const aboutText = settings.about_text?.trim() || '';
  const photos = Array.isArray(settings.photos) ? settings.photos.filter(Boolean) : [];

  // Schema.org Restaurant JSON-LD
  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name,
  };
  if (address) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      streetAddress: address,
      addressLocality: 'Bengaluru',
      addressRegion: 'Karnataka',
      addressCountry: 'IN',
    };
  }
  if (phone) jsonLd.telephone = phone;
  if (tagline) jsonLd.servesCuisine = tagline;
  if (mapsUrl) jsonLd.hasMap = mapsUrl;
  if (openingHours) {
    jsonLd.openingHours = openingHours.split('\n').map(l => l.trim()).filter(Boolean);
  }

  return (
    <>
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-paper text-ink selection:bg-chilli selection:text-white">
        <main className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12">
          {/* SECTION 1: TOP HEADER */}
          <section className="text-center pb-8 border-b border-rule">
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-ink">
              {name}
            </h1>
            {tagline && (
              <p className="text-xs sm:text-sm uppercase tracking-widest text-ink-muted mt-2 font-medium">
                {tagline}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              <a
                href="#menu"
                className="px-5 py-2.5 bg-ink text-paper text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-black transition-colors"
              >
                View menu &darr;
              </a>

              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-white text-ink border border-ink/40 text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-paper-subtle transition-colors inline-flex items-center gap-1.5"
                >
                  Get directions &rarr;
                </a>
              )}

              {phone && (
                <a
                  href={`tel:${phone.replace(/[^0-9+]/g, '')}`}
                  className="px-4 py-2.5 bg-white text-ink border border-ink/40 text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-paper-subtle transition-colors"
                >
                  Call: {phone}
                </a>
              )}
            </div>
          </section>

          {/* SECTION 2: ABOUT (Hidden if empty) */}
          {aboutText && (
            <section className="py-8 border-b border-rule">
              <div className="max-w-2xl mx-auto text-center">
                <h2 className="text-xs uppercase tracking-widest font-black text-ink-muted mb-2">
                  About Us
                </h2>
                <p className="font-serif text-base sm:text-lg text-ink leading-relaxed">
                  {aboutText}
                </p>
              </div>
            </section>
          )}

          {/* SECTION 3: MENU (Read-only, printed-menu-card style, 2-col on laptop) */}
          <PublicMenuView
            categories={categories}
            items={items}
            combos={combos}
          />

          {/* SECTIONS 4 & 5: VISIT US & PHOTOS (Side-by-side on laptop) */}
          {(address || phone || openingHours || mapsUrl || photos.length > 0) && (
            <section className="py-10 border-t border-rule">
              <div className={`grid grid-cols-1 ${photos.length > 0 ? 'lg:grid-cols-2 lg:gap-12' : 'max-w-2xl mx-auto'} gap-8`}>
                {/* Visit Us */}
                <div className="space-y-4">
                  <div className="border-b border-rule pb-1">
                    <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink">
                      Visit Us
                    </h2>
                  </div>

                  <dl className="space-y-3 text-xs sm:text-sm">
                    {address && (
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">
                          Address
                        </dt>
                        <dd className="font-medium text-ink mt-0.5 leading-snug">
                          {address}
                        </dd>
                      </div>
                    )}

                    {phone && (
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">
                          Phone
                        </dt>
                        <dd className="font-medium text-ink mt-0.5">
                          <a href={`tel:${phone.replace(/[^0-9+]/g, '')}`} className="underline hover:text-chilli">
                            {phone}
                          </a>
                        </dd>
                      </div>
                    )}

                    {openingHours && (
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">
                          Opening Hours
                        </dt>
                        <dd className="font-mono text-xs text-ink mt-1 space-y-0.5 leading-relaxed whitespace-pre-line">
                          {openingHours}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {mapsUrl && (
                    <div className="pt-2">
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-chilli hover:underline"
                      >
                        Open in Google Maps &rarr;
                      </a>
                    </div>
                  )}
                </div>

                {/* Photos Gallery (Only if owner uploaded, max 6, no stock photos) */}
                {photos.length > 0 && (
                  <div>
                    <div className="border-b border-rule pb-1 mb-4">
                      <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink">
                        Photos
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {photos.slice(0, 6).map((photoUrl, idx) => (
                        <div
                          key={idx}
                          className="aspect-square border border-rule bg-paper-card overflow-hidden rounded-sm"
                        >
                          <img
                            src={photoUrl}
                            alt={`${name} photo ${idx + 1}`}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>

        {/* SECTION 6: FOOTER (Restaurant name, address, nothing else. NO Staff login link) */}
        <footer className="border-t border-rule bg-paper py-8 px-4 text-center">
          <div className="max-w-[1100px] mx-auto space-y-1">
            <p className="font-serif font-bold text-sm text-ink">
              {name}
            </p>
            {address && (
              <p className="text-xs text-ink-muted">
                {address}
              </p>
            )}
          </div>
        </footer>
      </div>
    </>
  );
}
