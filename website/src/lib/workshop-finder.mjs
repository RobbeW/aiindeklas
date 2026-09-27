const distanceFromRange = (minutes, range) => {
  if (!range) return 0;
  if (minutes < range.min) return range.min - minutes;
  if (minutes > range.max) return minutes - range.max;
  return 0;
};

export const recommendWorkshops = (data, choice) => {
  const category = data.questions.q2_need.options.find((option) => option.id === choice.need)?.route_to_category;
  if (!category || (choice.need === "vakspecifiek" && !choice.subject)) return [];
  const group = data.questions.q4_group_size.options.find((option) => option.id === choice.groupSize);
  const duration = data.questions.q3_duration.options.find((option) => option.id === choice.duration)?.target_minutes ?? null;
  if (!group || choice.groupSize === "meer_dan_100") return [];
  const personaPreferences = data.personas[choice.persona]?.ranking_preferences ?? [];

  return data.offers
    .filter((offer) => offer.published && offer.category === category &&
      (category !== "vakspecifieke_professionalisering" || offer.subcategory === choice.subject))
    .flatMap((offer) => {
      const formats = offer.formats.filter((format) => format.max_group_size == null || format.max_group_size >= group.min);
      if (!formats.length) return [];
      const rankedFormats = formats.map((format) => ({ format, distance: distanceFromRange(format.duration_minutes, duration) }))
        .sort((a, b) => a.distance - b.distance);
      const best = rankedFormats[0];
      const groupConfirmed = best.format.max_group_size != null && best.format.max_group_size >= group.max;
      const personaIndex = personaPreferences.indexOf(offer.id);
      const personaScore = personaIndex >= 0 ? 3 - Math.min(personaIndex, 2) : 0;
      const durationScore = duration ? Math.max(0, 10 - best.distance / 15) : 0;
      const score = 50 + (category === "vakspecifieke_professionalisering" ? 30 : 0) +
        durationScore + (groupConfirmed ? 7 : 0) + personaScore;
      return [{ offer, formats, bestFormat: best.format, exactDuration: best.distance === 0,
        groupConfirmed, score }];
    })
    .sort((a, b) => b.score - a.score || a.offer.title.localeCompare(b.offer.title, "nl"))
    .slice(0, data.maxRecommendations);
};

export const relatedProjects = (data, choice) => {
  const category = data.questions.q2_need.options.find((option) => option.id === choice.need)?.route_to_category;
  return data.projects.filter((project) => project.category === category &&
    (category !== "vakspecifieke_professionalisering" || project.subcategory === choice.subject))
    .slice(0, data.maxProjects);
};

// Presentation-neutral domain adapter.  It deliberately accepts the already
// loaded Astro records so this layer never becomes a second catalogue.
const recordData = (record) => record?.data ?? record ?? {};
const slug = (value) => String(value ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const verifiedRoute = (record, routes = new Set()) => {
  const value = recordData(record);
  const candidate = value.route ?? value.path ?? value.seo?.canonical_path ?? (value.slug ? `/onderwijs/${value.slug}` : null);
  return candidate && routes.has(candidate) ? candidate : null;
};

/** Build the single catalogue consumed by catalogue, finder and detail views. */
export const buildWorkshopCatalogue = ({ brief, catalogueBrief = brief, designBrief = {}, workshops = [], projects = [], articles = [], verifiedRoutes = [] }) => {
  brief = catalogueBrief;
  const routes = new Set(verifiedRoutes);
  const workshopByTitle = new Map(workshops.map((record) => [recordData(record).title, record]));
  const offers = Object.entries(brief.bookable_offers ?? {}).filter(([, offer]) => offer.published === true).map(([id, offer]) => {
    const source = workshopByTitle.get(offer.published_title);
    if (!source) return null;
    const sourceData = recordData(source);
    const formats = (offer.published_formats ?? []).filter((format) => !offer.finder_exposed_formats || offer.finder_exposed_formats.includes(format.type)).map((format) => ({
      type: format.type, durationMinutes: format.duration_minutes ?? format.duration_minutes_for_routing ?? null,
      maxGroupSize: format.max_group_size ?? null, unknownDuration: !Number.isFinite(format.duration_minutes ?? format.duration_minutes_for_routing),
      unknownCapacity: format.max_group_size == null
    }));
    return { id, title: offer.published_title, category: offer.primary_category, subcategory: offer.subcategory ?? null,
      published: true, slug: sourceData.slug, route: verifiedRoute(source, routes), image: sourceData.hero ?? sourceData.seo?.image ?? null,
      formats, audience: offer.published_audience ?? [], tags: offer.topic_tags ?? [], source: sourceData,
      durationConflict: Boolean(offer.data_quality?.duration_conflict), durationEvidence: offer.data_quality ?? null };
  }).filter(Boolean);
  const projectById = new Map(projects.map((record) => [recordData(record).id ?? recordData(record).slug, record]));
  const articleById = new Map(articles.map((record) => [recordData(record).id ?? recordData(record).slug, record]));
  const relationshipRows = designBrief.related_content?.existing_candidate_relationships ?? brief.related_content?.existing_candidate_relationships ?? [];
  const related = (offer) => (relationshipRows.find((row) => row.workshop === offer.title)?.articles ?? [])
    .map((title, index) => {
      const key = slug(title);
      const projectMeta = Object.values(brief.supporting_projects ?? {}).find((p) => slug(p.published_title) === key);
      const source = projectMeta?.bookable_offer === false ? (projectById.get(key) ?? [...projectById.values()].find((r) => slug(recordData(r).title) === key)) : null;
      const article = articleById.get(key) ?? [...articleById.values()].find((r) => slug(recordData(r).title) === key);
      const record = article ?? source;
      const route = record ? verifiedRoute(record, routes) : null;
      return route ? { id: key, title, route, kind: article ? "article" : "project", rank: index } : null;
    }).filter(Boolean).slice(0, 2);
  return { offers, categories: brief.categories ?? {}, relatedFor: related };
};

export const rankWorkshopOffers = (catalogue, choice, brief) => {
  const questions = brief.questions ?? brief.onboarding_questions;
  const category = questions?.q2_need?.options?.find((x) => x.id === choice.need)?.route_to_category;
  if (!category || (category === "vakspecifieke_professionalisering" && !choice.subject) || choice.groupSize === "meer_dan_100") return [];
  const group = questions?.q4_group_size?.options?.find((x) => x.id === choice.groupSize);
  const duration = questions?.q3_duration?.options?.find((x) => x.id === choice.duration)?.target_minutes;
  const preferences = brief.personas?.[choice.persona]?.ranking_preferences ?? [];
  return catalogue.offers.filter((o) => o.category === category && (category !== "vakspecifieke_professionalisering" || o.subcategory === choice.subject)).flatMap((offer) => {
    const formats = offer.formats.filter((f) => f.maxGroupSize == null || !group || f.maxGroupSize >= group.min);
    if (!formats.length) return [];
    const distance = (f) => !duration || f.durationMinutes == null ? 0 : Math.max(f.durationMinutes - duration.max, duration.min - f.durationMinutes, 0);
    const format = [...formats].sort((a, b) => distance(a) - distance(b))[0];
    const durationScore = !duration || format.durationMinutes == null ? 0 : Math.max(0, 10 - distance(format) / 15);
    const preferenceIndex = preferences.indexOf(offer.id);
    const score = 50 + (category === "vakspecifieke_professionalisering" ? 30 : 0) + durationScore + (format.maxGroupSize != null ? 7 : 0) + (preferenceIndex >= 0 ? 3 - Math.min(preferenceIndex, 2) : 0);
    return [{ ...offer, selectedFormat: format, score, related: catalogue.relatedFor(offer) }];
  }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "nl")).slice(0, brief.recommendation_logic?.result_limit ?? brief.result_page?.max_recommendations ?? 3);
};

export const adaptWorkshopCatalogue = buildWorkshopCatalogue;
