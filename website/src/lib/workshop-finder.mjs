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
