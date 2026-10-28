export function replaceContactFormCopy(body) {
  return body.replace(
    /Via het formulier op deze webpagina kan je een vraag stellen over een lesproject of \[nascholing\]\([^)]*\)\./i,
    "Vul het formulier hierboven in. De knop opent een vooraf ingevulde e-mail in je standaard mailprogramma."
  );
}
