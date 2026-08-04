import type { GalleryLang } from './gallery-design';

/** Client-gallery UI strings for every language a photographer can pick in
 *  the design constructor. The gallery has a small, fixed set of strings, so
 *  translations live here in code — no DB round-trip, no partial locales. */

export interface GalleryStrings {
  name: string;        // native language name for the cabinet picker
  dateLocale: string;  // BCP-47 tag for date formatting
  view: string;
  daysLeft: (n: number) => string;
  downloadAll: string;
  photosCount: (n: number) => string;
  hintBefore: string;  // text before the inline heart
  hintAfter: string;   // text after the inline heart
  emptyUploading: string;
  emptyFav: string;
  photographerPage: string;
  createdOn: string;
  expiredText: string;
  phone: string;
  website: string;
  zipError: string;
  favAdd: string;
  favRemove: string;
  ariaPrev: string;
  ariaNext: string;
  ariaClose: string;
  ariaDownload: string;
}

// 1/2-4/5+ plural helper for Slavic languages (also handles 11-14 correctly).
const slavic = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export const GALLERY_I18N: Record<GalleryLang, GalleryStrings> = {
  uk: {
    name: 'Українська', dateLocale: 'uk-UA',
    view: 'Переглянути',
    daysLeft: n => `ще ${n} ${slavic(n, 'день', 'дні', 'днів')}`,
    downloadAll: 'Завантажити все',
    photosCount: n => `${n} фото`,
    hintBefore: 'Позначайте серцем', hintAfter: 'фото, які хочете надрукувати — фотограф побачить ваш вибір.',
    emptyUploading: 'Фотограф ще завантажує фото — загляньте трохи згодом.',
    emptyFav: 'Ви ще не обрали жодного фото.',
    photographerPage: 'Сторінка фотографа',
    createdOn: 'Галерею створено на',
    expiredText: 'Термін зберігання галереї минув. Фото зберігалися 30 днів і були видалені автоматично. Якщо вони вам потрібні — зверніться до фотографа.',
    phone: 'Телефон', website: 'Сайт',
    zipError: 'Не вдалося сформувати архів. Спробуйте ще раз.',
    favAdd: 'Додати в обрані', favRemove: 'Прибрати з обраних',
    ariaPrev: 'Попереднє', ariaNext: 'Наступне', ariaClose: 'Закрити', ariaDownload: 'Завантажити',
  },
  en: {
    name: 'English', dateLocale: 'en-GB',
    view: 'View',
    daysLeft: n => `${n} ${n === 1 ? 'day' : 'days'} left`,
    downloadAll: 'Download all',
    photosCount: n => `${n} ${n === 1 ? 'photo' : 'photos'}`,
    hintBefore: 'Tap the heart', hintAfter: 'on the photos you would like to print — your photographer will see your picks.',
    emptyUploading: 'Your photographer is still uploading photos — check back soon.',
    emptyFav: 'You have not picked any photos yet.',
    photographerPage: 'Photographer page',
    createdOn: 'Gallery created on',
    expiredText: 'This gallery has expired. Photos were stored for 30 days and have been deleted automatically. If you still need them, please contact your photographer.',
    phone: 'Phone', website: 'Website',
    zipError: 'Could not build the archive. Please try again.',
    favAdd: 'Add to favourites', favRemove: 'Remove from favourites',
    ariaPrev: 'Previous', ariaNext: 'Next', ariaClose: 'Close', ariaDownload: 'Download',
  },
  pl: {
    name: 'Polski', dateLocale: 'pl-PL',
    view: 'Zobacz',
    daysLeft: n => `zostało ${n} ${slavic(n, 'dzień', 'dni', 'dni')}`,
    downloadAll: 'Pobierz wszystko',
    photosCount: n => `${n} ${slavic(n, 'zdjęcie', 'zdjęcia', 'zdjęć')}`,
    hintBefore: 'Zaznacz serduszkiem', hintAfter: 'zdjęcia, które chcesz wydrukować — fotograf zobaczy Twój wybór.',
    emptyUploading: 'Fotograf wciąż dodaje zdjęcia — zajrzyj tu wkrótce.',
    emptyFav: 'Nie wybrano jeszcze żadnych zdjęć.',
    photographerPage: 'Strona fotografa',
    createdOn: 'Galeria utworzona na',
    expiredText: 'Okres przechowywania galerii minął. Zdjęcia były przechowywane przez 30 dni i zostały automatycznie usunięte. Jeśli ich potrzebujesz — skontaktuj się z fotografem.',
    phone: 'Telefon', website: 'Strona',
    zipError: 'Nie udało się utworzyć archiwum. Spróbuj ponownie.',
    favAdd: 'Dodaj do ulubionych', favRemove: 'Usuń z ulubionych',
    ariaPrev: 'Poprzednie', ariaNext: 'Następne', ariaClose: 'Zamknij', ariaDownload: 'Pobierz',
  },
  de: {
    name: 'Deutsch', dateLocale: 'de-DE',
    view: 'Ansehen',
    daysLeft: n => `noch ${n} ${n === 1 ? 'Tag' : 'Tage'}`,
    downloadAll: 'Alles herunterladen',
    photosCount: n => `${n} ${n === 1 ? 'Foto' : 'Fotos'}`,
    hintBefore: 'Markieren Sie mit dem Herz', hintAfter: 'die Fotos, die Sie drucken möchten — Ihr Fotograf sieht Ihre Auswahl.',
    emptyUploading: 'Ihr Fotograf lädt noch Fotos hoch — schauen Sie bald wieder vorbei.',
    emptyFav: 'Sie haben noch keine Fotos ausgewählt.',
    photographerPage: 'Seite des Fotografen',
    createdOn: 'Galerie erstellt auf',
    expiredText: 'Die Speicherfrist dieser Galerie ist abgelaufen. Die Fotos wurden 30 Tage gespeichert und automatisch gelöscht. Bei Bedarf wenden Sie sich bitte an Ihren Fotografen.',
    phone: 'Telefon', website: 'Webseite',
    zipError: 'Das Archiv konnte nicht erstellt werden. Bitte versuchen Sie es erneut.',
    favAdd: 'Zu Favoriten hinzufügen', favRemove: 'Aus Favoriten entfernen',
    ariaPrev: 'Zurück', ariaNext: 'Weiter', ariaClose: 'Schließen', ariaDownload: 'Herunterladen',
  },
  cs: {
    name: 'Čeština', dateLocale: 'cs-CZ',
    view: 'Zobrazit',
    daysLeft: n => `zbývá ${n} ${slavic(n, 'den', 'dny', 'dní')}`,
    downloadAll: 'Stáhnout vše',
    photosCount: n => `${n} ${slavic(n, 'fotka', 'fotky', 'fotek')}`,
    hintBefore: 'Označte srdíčkem', hintAfter: 'fotky, které chcete vytisknout — fotograf váš výběr uvidí.',
    emptyUploading: 'Fotograf ještě nahrává fotky — zkuste to prosím později.',
    emptyFav: 'Zatím jste nevybrali žádné fotky.',
    photographerPage: 'Stránka fotografa',
    createdOn: 'Galerie vytvořena na',
    expiredText: 'Doba uložení galerie vypršela. Fotky byly uloženy 30 dní a byly automaticky smazány. Pokud je potřebujete, obraťte se na svého fotografa.',
    phone: 'Telefon', website: 'Web',
    zipError: 'Archiv se nepodařilo vytvořit. Zkuste to prosím znovu.',
    favAdd: 'Přidat do oblíbených', favRemove: 'Odebrat z oblíbených',
    ariaPrev: 'Předchozí', ariaNext: 'Další', ariaClose: 'Zavřít', ariaDownload: 'Stáhnout',
  },
  it: {
    name: 'Italiano', dateLocale: 'it-IT',
    view: 'Guarda',
    daysLeft: n => n === 1 ? 'ultimo giorno' : `${n} giorni rimasti`,
    downloadAll: 'Scarica tutto',
    photosCount: n => `${n} foto`,
    hintBefore: 'Segna con il cuore', hintAfter: 'le foto che vuoi stampare — il fotografo vedrà la tua selezione.',
    emptyUploading: 'Il fotografo sta ancora caricando le foto — torna presto.',
    emptyFav: 'Non hai ancora scelto nessuna foto.',
    photographerPage: 'Pagina del fotografo',
    createdOn: 'Galleria creata su',
    expiredText: 'Il periodo di conservazione della galleria è scaduto. Le foto sono state conservate per 30 giorni e sono state eliminate automaticamente. Se ti servono, contatta il tuo fotografo.',
    phone: 'Telefono', website: 'Sito',
    zipError: 'Impossibile creare l’archivio. Riprova.',
    favAdd: 'Aggiungi ai preferiti', favRemove: 'Rimuovi dai preferiti',
    ariaPrev: 'Precedente', ariaNext: 'Successiva', ariaClose: 'Chiudi', ariaDownload: 'Scarica',
  },
  es: {
    name: 'Español', dateLocale: 'es-ES',
    view: 'Ver',
    daysLeft: n => n === 1 ? 'queda 1 día' : `quedan ${n} días`,
    downloadAll: 'Descargar todo',
    photosCount: n => `${n} ${n === 1 ? 'foto' : 'fotos'}`,
    hintBefore: 'Marca con el corazón', hintAfter: 'las fotos que quieras imprimir — tu fotógrafo verá tu selección.',
    emptyUploading: 'Tu fotógrafo aún está subiendo fotos — vuelve pronto.',
    emptyFav: 'Aún no has elegido ninguna foto.',
    photographerPage: 'Página del fotógrafo',
    createdOn: 'Galería creada en',
    expiredText: 'El período de almacenamiento de la galería ha expirado. Las fotos se guardaron durante 30 días y se eliminaron automáticamente. Si las necesitas, contacta con tu fotógrafo.',
    phone: 'Teléfono', website: 'Sitio web',
    zipError: 'No se pudo crear el archivo. Inténtalo de nuevo.',
    favAdd: 'Añadir a favoritos', favRemove: 'Quitar de favoritos',
    ariaPrev: 'Anterior', ariaNext: 'Siguiente', ariaClose: 'Cerrar', ariaDownload: 'Descargar',
  },
  fr: {
    name: 'Français', dateLocale: 'fr-FR',
    view: 'Voir',
    daysLeft: n => n === 1 ? 'dernier jour' : `${n} jours restants`,
    downloadAll: 'Tout télécharger',
    photosCount: n => `${n} photo${n === 1 ? '' : 's'}`,
    hintBefore: 'Marquez d’un cœur', hintAfter: 'les photos que vous souhaitez imprimer — votre photographe verra votre sélection.',
    emptyUploading: 'Votre photographe ajoute encore des photos — revenez bientôt.',
    emptyFav: 'Vous n’avez encore choisi aucune photo.',
    photographerPage: 'Page du photographe',
    createdOn: 'Galerie créée sur',
    expiredText: 'La période de conservation de la galerie est expirée. Les photos ont été conservées 30 jours puis supprimées automatiquement. Si vous en avez besoin, contactez votre photographe.',
    phone: 'Téléphone', website: 'Site',
    zipError: 'Impossible de créer l’archive. Veuillez réessayer.',
    favAdd: 'Ajouter aux favoris', favRemove: 'Retirer des favoris',
    ariaPrev: 'Précédente', ariaNext: 'Suivante', ariaClose: 'Fermer', ariaDownload: 'Télécharger',
  },
  ro: {
    name: 'Română', dateLocale: 'ro-RO',
    view: 'Vezi',
    daysLeft: n => n === 1 ? 'a mai rămas 1 zi' : `au mai rămas ${n} zile`,
    downloadAll: 'Descarcă tot',
    photosCount: n => `${n} ${n === 1 ? 'fotografie' : 'fotografii'}`,
    hintBefore: 'Marchează cu inimă', hintAfter: 'fotografiile pe care vrei să le printezi — fotograful va vedea alegerea ta.',
    emptyUploading: 'Fotograful încă încarcă fotografiile — revino în curând.',
    emptyFav: 'Nu ai ales încă nicio fotografie.',
    photographerPage: 'Pagina fotografului',
    createdOn: 'Galerie creată pe',
    expiredText: 'Perioada de stocare a galeriei a expirat. Fotografiile au fost păstrate 30 de zile și au fost șterse automat. Dacă ai nevoie de ele, contactează fotograful.',
    phone: 'Telefon', website: 'Site',
    zipError: 'Arhiva nu a putut fi creată. Încearcă din nou.',
    favAdd: 'Adaugă la favorite', favRemove: 'Elimină din favorite',
    ariaPrev: 'Anterioară', ariaNext: 'Următoarea', ariaClose: 'Închide', ariaDownload: 'Descarcă',
  },
};
