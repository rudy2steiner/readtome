import { primaryLang } from './voices';

/**
 * Landing / first-visit copy the reader can swap when the language filter changes.
 * Edited documents are left alone — only these exact strings count as still-a-demo.
 */
const DEMO: Record<string, string> = {
  en: 'Welcome to Read to Me.\nPress play, and this text is read aloud to you — in a natural voice, at the speed you choose.\nBring anything you would like to hear: paste an article, upload a document, or write your own notes.\nAs it reads, the current sentence is highlighted, so you can follow along.\nTry a few voices and speeds from the player below.',
  zh: '欢迎使用「为我朗读」。\n点击播放，这段文字就会用自然的语音、按您选择的语速念给您听。\n想听什么都可以：粘贴一篇文章、上传一份文档，或者写下自己的笔记。\n朗读时，当前这句会高亮显示，方便您跟着一起看。\n在下方播放器里试试不同的音色和语速吧。',
  ja: '「Read to Me」へようこそ。\n再生を押すと、選んだ声と速さで、この文章を読み上げます。\n聞きたいものは何でもどうぞ。記事を貼る、.txt を入れる、自分のメモを書く。\n読んでいる文はハイライトされるので、目で追いながら聴けます。\n下のプレーヤーで、声と速さを試してみてください。',
  ko: 'Read to Me에 오신 것을 환영합니다.\n재생을 누르면 고른 목소리와 속도로 이 글을 읽어 줍니다.\n듣고 싶은 것은 무엇이든 좋아요. 글을 붙여 넣거나 .txt 파일을 넣거나 메모를 적어 보세요.\n읽고 있는 문장은 하이라이트되어 눈으로 따라갈 수 있습니다.\n아래 플레이어에서 목소리와 속도를 바꿔 보세요.',
  es: 'Bienvenido a Read to Me.\nPulsa reproducir y este texto se leerá en voz alta, con la voz y la velocidad que elijas.\nTrae lo que quieras oír: pega un artículo, suelta un archivo .txt o escribe tus notas.\nMientras lee, la frase actual se resalta para que puedas seguirla.\nPrueba distintas voces y velocidades en el reproductor de abajo.',
  fr: 'Bienvenue sur Read to Me.\nAppuyez sur lecture : ce texte vous est lu à voix haute, avec la voix et la vitesse que vous choisissez.\nApportez ce que vous voulez entendre : collez un article, déposez un fichier .txt ou écrivez vos notes.\nPendant la lecture, la phrase en cours est surlignée pour que vous puissiez suivre.\nEssayez quelques voix et vitesses dans le lecteur ci-dessous.',
  de: 'Willkommen bei Read to Me.\nDrücke auf Play – dieser Text wird dir vorgelesen, mit der Stimme und dem Tempo, das du wählst.\nBring mit, was du hören möchtest: einen Artikel einfügen, eine .txt-Datei ablegen oder eigene Notizen schreiben.\nBeim Vorlesen wird der aktuelle Satz markiert, damit du mitlesen kannst.\nProbier unten im Player verschiedene Stimmen und Tempi.',
  it: 'Benvenuto in Read to Me.\nPremi play e questo testo viene letto ad alta voce, con la voce e la velocità che scegli.\nPorta quello che vuoi ascoltare: incolla un articolo, carica un file .txt o scrivi i tuoi appunti.\nMentre legge, la frase corrente è evidenziata così puoi seguire.\nProva alcune voci e velocità nel lettore qui sotto.',
  pt: 'Bem-vindo ao Read to Me.\nToque em reproduzir e este texto será lido em voz alta, com a voz e a velocidade que você escolher.\nTraga o que quiser ouvir: cole um artigo, solte um arquivo .txt ou escreva suas notas.\nEnquanto lê, a frase atual é destacada para você acompanhar.\nExperimente vozes e velocidades no player abaixo.',
  ru: 'Добро пожаловать в Read to Me.\nНажмите «играть» — этот текст прочитают вслух выбранным голосом и в выбранном темпе.\nПринесите всё, что хотите услышать: вставьте статью, загрузите .txt или напишите свои заметки.\nПока идёт чтение, текущее предложение подсвечивается, чтобы вы могли следить.\nПопробуйте разные голоса и скорости в плеере ниже.',
  ar: 'مرحباً بك في Read to Me.\nاضغط تشغيل، وستُقرأ لك هذه الكلمات بصوت طبيعي وبالسرعة التي تختارها.\nأحضر أي شيء تريد سماعه: الصق مقالاً، أو أدرج ملف .txt، أو اكتب ملاحظاتك.\nأثناء القراءة تُظلل الجملة الحالية حتى تتمكن من المتابعة.\nجرّب بعض الأصوات والسرعات من المشغّل أدناه.',
  hi: 'Read to Me में आपका स्वागत है।\nप्ले दबाएँ, और यह पाठ आपको चुनी हुई आवाज़ और गति से सुनाया जाएगा।\nजो सुनना हो वह लाएँ: कोई लेख चिपकाएँ, .txt फ़ाइल डालें, या अपने नोट लिखें।\nपढ़ते समय वर्तमान वाक्य हाइलाइट होता है, ताकि आप साथ चल सकें।\nनीचे प्लेयर में कुछ आवाज़ें और गति आज़माएँ।',
  nl: 'Welkom bij Read to Me.\nDruk op afspelen, dan wordt deze tekst hardop voorgelezen met de stem en snelheid die jij kiest.\nBreng wat je wilt horen: plak een artikel, zet een .txt-bestand neer of schrijf je eigen notities.\nTijdens het voorlezen wordt de huidige zin gemarkeerd, zodat je kunt meelezen.\nProbeer hieronder een paar stemmen en snelheden.',
  pl: 'Witamy w Read to Me.\nNaciśnij odtwarzanie, a ten tekst zostanie przeczytany na głos wybranym głosem i w wybranym tempie.\nPrzynieś, czego chcesz posłuchać: wklej artykuł, wrzuć plik .txt albo napisz własne notatki.\nPodczas czytania bieżące zdanie jest podświetlane, żebyś mógł śledzić tekst.\nWypróbuj głosy i prędkości w odtwarzaczu poniżej.',
  tr: 'Read to Me’ye hoş geldiniz.\nOynat’a basın; bu metin seçtiğiniz ses ve hızla size okunur.\nDinlemek istediğiniz her şeyi getirin: bir yazı yapıştırın, bir .txt bırakın veya notlarınızı yazın.\nOkurken geçerli cümle vurgulanır, böylece metni takip edebilirsiniz.\nAşağıdaki oynatıcıda birkaç ses ve hız deneyin.',
  vi: 'Chào mừng bạn đến với Read to Me.\nBấm phát, đoạn này sẽ được đọc thành tiếng với giọng và tốc độ bạn chọn.\nMang theo bất cứ gì bạn muốn nghe: dán một bài viết, thả file .txt, hoặc viết ghi chú của bạn.\nKhi đang đọc, câu hiện tại được tô sáng để bạn theo dõi.\nThử vài giọng và tốc độ ở trình phát bên dưới.',
  th: 'ยินดีต้อนรับสู่ Read to Me\nกดเล่น แล้วข้อความนี้จะถูกอ่านให้ฟังด้วยเสียงและความเร็วที่คุณเลือก\nเอาอะไรมาฟังก็ได้ วางบทความ ใส่ไฟล์ .txt หรือเขียนบันทึกเอง\nตอนอ่าน ประโยคปัจจุบันจะไฮไลต์ ให้ตามไปด้วยตาได้\nลองเปลี่ยนเสียงและความเร็วที่เครื่องเล่นด้านล่าง',
  id: 'Selamat datang di Read to Me.\nTekan putar, dan teks ini dibacakan dengan suara serta kecepatan yang kamu pilih.\nBawa apa pun yang ingin didengar: tempel artikel, jatuhkan file .txt, atau tulis catatanmu.\nSaat dibacakan, kalimat yang sedang dibaca disorot agar kamu bisa mengikuti.\nCoba beberapa suara dan kecepatan di pemutar di bawah.',
  sv: 'Välkommen till Read to Me.\nTryck på play så läses den här texten upp med rösten och farten du väljer.\nTa med det du vill höra: klistra in en artikel, släpp en .txt-fil eller skriv egna anteckningar.\nMedan det läses markeras den aktuella meningen så att du kan följa med.\nProva några röster och hastigheter i spelaren nedan.',
  da: 'Velkommen til Read to Me.\nTryk på play, så bliver denne tekst læst op med den stemme og hastighed, du vælger.\nTag det med, du vil høre: sæt en artikel ind, slip en .txt-fil eller skriv dine egne noter.\nMens der læses, fremhæves den aktuelle sætning, så du kan følge med.\nPrøv et par stemmer og hastigheder i afspilleren nedenfor.',
  fi: 'Tervetuloa Read to Me -palveluun.\nPaina toistoa, niin tämä teksti luetaan ääneen valitsemallasi äänellä ja nopeudella.\nTuo mitä tahansa haluat kuulla: liitä artikkeli, pudota .txt-tiedosto tai kirjoita muistiinpanoja.\nLukiessa nykyinen virke korostuu, jotta voit seurata mukana.\nKokeile ääniä ja nopeuksia alla olevasta soittimesta.',
  nb: 'Velkommen til Read to Me.\nTrykk på spill av, så blir denne teksten lest opp med stemmen og farten du velger.\nTa med det du vil høre: lim inn en artikkel, slipp en .txt-fil eller skriv dine egne notater.\nMens det leses, utheves den aktuelle setningen så du kan følge med.\nPrøv noen stemmer og hastigheter i avspilleren under.',
  cs: 'Vítejte v Read to Me.\nStiskněte přehrát a tento text se vám přečte zvoleným hlasem a tempem.\nPřineste, co chcete slyšet: vložte článek, přetáhněte soubor .txt nebo napište vlastní poznámky.\nBěhem čtení se aktuální věta zvýrazní, abyste mohli sledovat text.\nV přehrávači níže vyzkoušejte hlasy a rychlosti.',
  el: 'Καλώς ήρθατε στο Read to Me.\nΠατήστε αναπαραγωγή και αυτό το κείμενο θα διαβαστεί δυνατά, με τη φωνή και την ταχύτητα που επιλέγετε.\nΦέρτε ό,τι θέλετε να ακούσετε: επικολλήστε ένα άρθρο, αφήστε ένα αρχείο .txt ή γράψτε τις σημειώσεις σας.\nΚαθώς διαβάζει, η τρέχουσα πρόταση τονίζεται ώστε να μπορείτε να ακολουθείτε.\nΔοκιμάστε φωνές και ταχύτητες στον παίκτη παρακάτω.',
  he: 'ברוכים הבאים אל Read to Me.\nלחצו על ניגון, והטקסט הזה יוקרא לכם בקול, בקול ובמהירות שתבחרו.\nהביאו כל מה שתרצו לשמוע: הדביקו מאמר, שחררו קובץ .txt או כתבו הערות.\nבזמן הקריאה המשפט הנוכחי מודגש כדי שתוכלו לעקוב.\nנסו כמה קולות ומהירויות בנגן למטה.',
  uk: 'Ласкаво просимо до Read to Me.\nНатисніть відтворення — цей текст прочитають вголос обраним голосом і в обраному темпі.\nПринесіть усе, що хочете почути: вставте статтю, завантажте .txt або напишіть свої нотатки.\nПід час читання поточне речення підсвічується, щоб ви могли стежити.\nСпробуйте різні голоси та швидкості в програвачі нижче.',
  hu: 'Üdvözöl a Read to Me.\nNyomj a lejátszásra, és ezt a szöveget a választott hangon és sebességgel olvassuk fel.\nHozz bármit, amit hallani szeretnél: illessz be egy cikket, dobj be egy .txt fájlt, vagy írd meg a jegyzeteidet.\nOlvasás közben az aktuális mondat kiemelődik, így követheted.\nPróbálj ki néhány hangot és sebességet a lejátszóban lent.',
  ro: 'Bun venit la Read to Me.\nApasă play și acest text îți este citit cu vocea și viteza pe care le alegi.\nAdu ce vrei să asculți: lipește un articol, pune un fișier .txt sau scrie-ți notițele.\nÎn timpul lecturii, propoziția curentă este evidențiată ca să poți urmări.\nÎncearcă câteva voci și viteze în playerul de mai jos.',
};

export function demoTextFor(lang: string, fallback = 'en'): string {
  const wanted = primaryLang(lang);
  if (wanted !== 'all' && wanted !== 'multi' && DEMO[wanted]) return DEMO[wanted];
  return DEMO[primaryLang(fallback)] ?? DEMO.en;
}

export function isDemoText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const collapsed = trimmed.replace(/\n{2,}/g, '\n');
  return Object.values(DEMO).some((sample) => {
    const demo = sample.trim();
    return demo === trimmed || demo === collapsed;
  });
}
