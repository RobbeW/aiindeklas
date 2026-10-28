import { load } from "cheerio";

export function inspectP09Html(html, label = "HTML") {
  const $ = load(html);
  const problems = [];
  const externalScripts = [];
  let providerLinks = 0;
  let unlabeledProviderLinks = 0;
  const add = (message) => problems.push(`${label}: ${message}`);
  const isRemote = (value) => /^(?:https?:)?\/\//i.test(value ?? "");

  const iframeCount = $("iframe").length;
  const embedCount = $("embed,object").length;
  if (iframeCount) add(`${iframeCount} iframe element(s) make automatic provider requests.`);
  if (embedCount) add(`${embedCount} embed/object element(s) found.`);

  $("script[src]").each((_, element) => {
    const src = $(element).attr("src") ?? "";
    if (isRemote(src)) externalScripts.push(src);
  });
  $("link[rel~='preload'][as='script'][href],link[rel='modulepreload'][href]").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    if (isRemote(href)) externalScripts.push(href);
  });
  if (externalScripts.length) add(`${externalScripts.length} automatic external script request(s): ${[...new Set(externalScripts)].slice(0, 5).join(", ")}`);

  if (/cdn\.embedly\.com|embedly-embed|data-html=["'][^"']*embedly|(?:embedly|embed_?key)[_-]?(?:key)?["'\s:=]+["']?[a-f0-9]{24,}/i.test(html)) {
    add("Embedly wrapper or key found.");
  }
  if (/squarespace\.com\/(?:universal\/scripts|static\/vta)|sqspcdn\.com\/website-component-definition|sqs-video-wrapper|sqs-native-video|sqs-block-(?:form|video|audio|embed)/i.test(html)) {
    add("Squarespace runtime or embed wrapper found.");
  }

  const formCount = $("form").length;
  const contactFormCount = $("form[data-contact-email-form]").length;
  let networkFormSubmissionCount = 0;
  $("form").each((_, element) => {
    const action = $(element).attr("action") ?? "";
    const method = ($(element).attr("method") ?? "").toLowerCase();
    if (action || method === "post" || method === "put") networkFormSubmissionCount += 1;
  });
  if (contactFormCount && formCount !== contactFormCount) add("Only the approved client-side contact email form may be present on a contact route.");
  if (contactFormCount && networkFormSubmissionCount) add("A form submission endpoint or network method was found.");
  $("form[data-contact-email-form]").each((_, element) => {
    if ($(element).attr("data-recipient") !== "robbe.wulgaert@gmail.com") add("Contact email form recipient is not the approved address.");
  });

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    let host = "";
    try { host = new URL(href).hostname.toLowerCase(); } catch { return; }
    if (!(host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be" || host === "vimeo.com" || host.endsWith(".vimeo.com"))) return;
    providerLinks += 1;
    const label = $(element).text().trim();
    if (!label || /^https?:\/\//i.test(label) || /source platform|click here/i.test(label)) unlabeledProviderLinks += 1;
  });
  if (unlabeledProviderLinks) add(`${unlabeledProviderLinks} video provider link(s) need a direct, meaningful label.`);

  return {
    problems,
    counts: {
      iframes: iframeCount,
      embeds_and_objects: embedCount,
      external_scripts: externalScripts.length,
      provider_links: providerLinks,
      unlabeled_provider_links: unlabeledProviderLinks,
      contact_email_visible: html.includes("robbe.wulgaert@gmail.com"),
      contact_mailto: $("a[href='mailto:robbe.wulgaert@gmail.com']").length,
      contact_form_recipient: $("form[data-contact-email-form][data-recipient='robbe.wulgaert@gmail.com']").length,
      contact_forms: contactFormCount,
      forms: formCount,
      network_form_submissions: networkFormSubmissionCount
    }
  };
}
