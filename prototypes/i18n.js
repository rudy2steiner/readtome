/* Read to Me — prototype i18n
 * Page copy is copied verbatim from messages/en.json and messages/zh.json so the
 * prototype keeps the same keywords and density as the live site.
 */
(function (global) {
  'use strict';

  var LANG_KEY = 'rtm.lang';

  var DICT = {
    en: {
      meta: {
        title: 'Read To Me: Turn text to speech in seconds | Free Online',
        description: 'Transform any text into natural-sounding speech in seconds. Whether you are learning, multitasking, or making content accessible, ReadToMe converts your documents into crystal-clear audio with lifelike voices in over 50 language!',
        readTitle: 'Text to Speech Reader — Read To Me'
      },
      common: { title: 'Read To Me', description: 'Turn text to speech in seconds for free' },
      nav: { home: 'Home', reader: 'Reader', features: 'Features', faq: 'FAQs', pricing: 'Pricing', start: 'Start reading' },
      ui: {
        benefits: 'Benefits',
        features: 'Capabilities',
        how: 'How it works',
        faq: 'Questions',
        noSignup: 'No sign-up — just press play',
        factVoices: '{n} voices in your browser',
        factFree: 'Free, with no usage limit',
        planned: 'Planned',
        todayUpload: 'Upload TXT, MD, HTML, PDF, DOCX, ODT, or EPUB. Old .doc files need to be saved as .docx.',
        todayExport: 'Today: playback only. Audio export is planned.',
        step: 'Step'
      },
      samples: {
        heroLabel: 'Real clips from our cloud voices (planned) — click one to listen',
        cta: 'Get cloud voices with Plus',
        ctaPrice: 'from $7/mo, billed yearly',
        natural: 'Natural',
        expressive: 'Expressive',
        playLabel: 'Play the {name} sample',
        playFailed: 'Your browser blocked audio playback. Tap the voice again.'
      },
      hero: {
        tagline: 'Your Personal Text Reader',
        title: 'Read to Me: Text to Natural Speech',
        description: 'Transform any text into natural-sounding speech with our AI voice technology. Perfect for learning, accessibility, and content consumption on the go.'
      },
      benefits: {
        title: 'Why Choose Read to Me',
        items: {
          quality: { title: 'Natural Voices', description: 'Lifelike speech with natural intonation and rhythm' },
          styles: { title: 'Multiple Languages', description: 'Support for over 50 languages and accents' },
          speed: { title: 'Instant Conversion', description: 'Convert text to speech in seconds' },
          batch: { title: 'Accessibility First', description: 'Make content accessible to everyone' }
        }
      },
      features: {
        title: 'Read To Me Features',
        items: {
          styleTransfer: { title: 'Voice Customization', description: 'Adjust speed, pitch, and emotion to match your needs' },
          customPrompts: { title: 'Document Support', description: 'Convert PDF, Word, and other document formats' },
          batchProcessing: { title: 'Batch Processing', description: 'Convert multiple documents at once' },
          highResolution: { title: 'Audio Export', description: 'Download in MP3, WAV, or other formats' }
        }
      },
      howItWorks: {
        title: 'How to Convert Text to Speech',
        steps: {
          upload: { number: '01', title: 'Input Your Text', description: 'Paste text' },
          style: { number: '02', title: 'Choose Voice', description: 'Select language and voice settings' },
          generate: { number: '03', title: 'Generate Audio', description: 'Convert text to speech instantly' },
          download: { number: '04', title: 'Save & Share', description: 'Download or share your audio file' }
        }
      },
      faq: {
        title: 'Read To Me FAQs',
        items: [
          { question: 'How does the text to speech work?', answer: 'Our AI technology converts text into natural-sounding speech using advanced neural networks.' },
          { question: 'What languages are supported?', answer: 'We support over 50 languages with multiple accent options for major languages.' },
          { question: 'Is the service free?', answer: 'Yes, basic text-to-speech features are free to use with limited duration.' },
          { question: 'What file formats can I upload?', answer: 'You can paste text, or upload TXT, Markdown, HTML, RTF, CSV, PDF, DOCX, ODT, and EPUB. Older .doc files need to be saved as .docx first.' },
          { question: 'Can I download the audio files?', answer: 'Yes, you can download audio in MP3, WAV, and other popular formats.' }
        ]
      },
      cta: {
        title: 'Ready to Give Your Text a Voice?',
        description: 'Convert your text to natural speech with our AI technology',
        button: 'Start Converting Now'
      },
      footer: {
        product: 'Product', features: 'Features', support: 'Support',
        rights: 'All rights reserved.',
        engines: 'Free voices: Web Speech · Cloud voices (planned): xAI TTS v1 and MiniMax Speech 2.6 Turbo on Atlas Cloud'
      },
      pricing: {
        metaTitle: 'Pricing — Read To Me',
        eyebrow: 'Pricing',
        title: 'Pay for the listening, not for the software',
        subtitle: 'Your browser\u2019s own voices stay free forever. Paid plans add cloud AI voices, measured in hours of listening.',
        yearly: 'Yearly',
        monthly: 'Monthly',
        save: 'Save 22%',
        perMonth: '/ month',
        billedYearly: 'billed as {amount} once a year',
        billedMonthly: 'billed monthly, cancel anytime',
        popular: 'Most popular',
        free: {
          name: 'Free',
          tagline: 'No account needed to start',
          forever: 'Free forever',
          cta: 'Start reading',
          f1: 'Browser voices, unlimited',
          f2: '10 minutes of cloud voices, once',
          f3: 'Sentence highlighting and resume where you left off',
          f4: 'Paste text or upload a document'
        },
        plus: {
          name: 'Plus',
          tagline: 'For a regular reading habit',
          cta: 'Choose Plus',
          f1: '8 hours a month of AI voices',
          f2: 'Expressive uses 3 minutes of quota per minute',
          f3: 'Everything in Free',
          f4: 'Re-listening never spends your quota'
        },
        pro: {
          name: 'Pro',
          tagline: 'For long books and heavy weeks',
          cta: 'Choose Pro',
          f1: '16 hours a month of AI voices',
          f2: 'Expressive uses 3 minutes of quota per minute',
          f3: 'Priority synthesis queue',
          f4: 'Top-up packs when you run out'
        },
        voices: {
          title: 'Three kinds of voices',
          subtitle: 'Plans differ in how much cloud speech they include, not in what the reader can do.',
          basicT: 'Basic',
          basicD: 'The voices already on your device. Free forever, no account, no limit.',
          naturalT: 'Natural',
          naturalD: 'Cloud AI voices for everyday listening — long articles and whole books.',
          expressiveT: 'Expressive',
          expressiveD: 'Emotion and pitch control. Uses 3 minutes of AI hours for every minute you hear.'
        },
        packs: {
          title: 'Run out mid-month?',
          subtitle: 'One +10 hour pack adds the same AI hours Plus and Pro already share.',
          hours: 'AI voices +10 hours',
          natural: 'AI voices +10 hours',
          expressive: 'AI voices +10 hours',
          buy: 'Add to plan',
          rule: 'Requires an active plan · spent only after your monthly quota · valid for 12 months',
          needPlan: 'Top-up packs need an active plan — subscribe first.'
        },
        notes: {
          title: 'Good to know',
          n1: 'Monthly time resets each billing period; unused time does not roll over.',
          n2: 'An hour of Natural is one hour; Expressive uses 3×. Listening time is the same in any language.',
          n3: 'Audio export is planned and not part of any plan yet.',
          n4: 'This page is a prototype. No payment is taken and no plan is created.'
        }
      },
      auth: {
        signIn: 'Sign in',
        signOut: 'Sign out',
        continueGoogle: 'Continue with Google',
        signInTitle: 'Sign in to Read to Me',
        signInSubtitle: 'Sign in to unlock premium AI voices and keep your reading library across devices.',
        signInNote: 'Prototype only — no real account is created. Production uses Google sign-in.',
        backHome: '← Back to home',
        plan: 'Plan',
        planFree: 'Free',
        usage: 'Usage',
        billing: 'Billing',
        signedInAs: 'Signed in as',
        usageNote: 'Free plan: unlimited browser voices. Premium characters: 0 used.'
      },
      reader: {
        heading: 'Reader',
        sub: 'Paste text, choose a voice, and follow along as it reads. Your text and position are remembered in this browser.',
        placeholder: 'Paste the text you want read aloud…',
        clear: 'Clear text',
        upload: 'Upload a document',
        smaller: 'Smaller text',
        bigger: 'Larger text',
        play: 'Play',
        pause: 'Pause',
        stop: 'Stop',
        speed: 'Playback speed',
        openFull: 'Open full reader →',
        tabPlayback: 'Playback',
        tabPronunciation: 'Pronunciation',
        language: 'Reading language',
        voiceSelection: 'Voice selection',
        filterAll: 'All',
        filterFree: 'Free',
        filterPro: 'Premium',
        allLanguages: 'All languages',
        groupCloud: 'Cloud voices',
        groupBrowser: 'Browser voices',
        seePlans: 'See plans →',
        systemVoice: 'System voice',
        note: 'Free voices come from your browser and have no usage limit. Premium AI voices are planned on Atlas Cloud MiniMax.',
        words: 'words',
        characters: 'characters',
        noVoices: 'No voices match this filter.',
        needText: 'Add some text first — paste an article or upload a document.',
        needTxt: 'This file type is not supported. Try TXT, MD, HTML, PDF, DOCX, ODT, or EPUB.',
        needFormat: 'This file type is not supported. Try TXT, MD, HTML, PDF, DOCX, ODT, or EPUB.',
        needDocx: 'Old .doc files are not supported — save as .docx and try again.',
        emptyFile: 'No readable text in that file.',
        tooLarge: 'That file is too large (15 MB max).',
        parseFailed: 'Could not read that file.',
        loaded: 'Loaded',
        blocked: 'This browser blocked audio playback. Tap play again to start.',
        noSpeech: 'This browser has no Web Speech support — text editing still works.',
        premiumSignIn: 'Cloud voices need a plan. Sign in first, then see Pricing.',
        premiumUpgrade: 'Cloud voices need a plan — see Pricing. Checkout is not wired up in this prototype.'
      },
      sample:
        'Welcome to Read to Me.\n\n' +
        'Press play, and this text is read aloud to you — in a natural voice, at the speed you choose.\n\n' +
        'Bring anything you would like to hear: paste an article, upload a document, or write your own notes.\n\n' +
        'As it reads, the current sentence is highlighted, so you can follow along.\n\n' +
        'Try a few voices and speeds from the player below.'
    },

    zh: {
      meta: {
        title: '为我朗读：几秒将文字转换为语音 | 免费在线',
        description: '免费即时将文字转换为语音。无论是学习、多任务处理还是让内容更易获取，为我朗读都能用逼真的语音把您的文档转成清晰的音频，支持超过 50 种语言！',
        readTitle: '文字转语音朗读器 — 为我朗读'
      },
      common: { title: '为我朗读', description: '免费即时将文字转换为语音' },
      nav: { home: '首页', reader: '朗读器', features: '功能', faq: '常见问题', pricing: '定价', start: '开始朗读' },
      ui: {
        benefits: '核心优势',
        features: '功能能力',
        how: '使用流程',
        faq: '常见疑问',
        noSignup: '无需注册，点开就听',
        factVoices: '浏览器可用 {n} 个音色',
        factFree: '免费，不限用量',
        planned: '规划中',
        todayUpload: '可上传 TXT、MD、HTML、PDF、DOCX、ODT、EPUB。旧版 .doc 请先另存为 .docx。',
        todayExport: '当前：仅支持朗读播放，音频导出规划中。',
        step: '步骤'
      },
      samples: {
        heroLabel: '云端音色的真实合成片段（规划中）—— 点头像试听',
        cta: '订阅 Plus 使用云端音色',
        ctaPrice: '年付低至 $7/月',
        natural: '自然',
        expressive: '表现力',
        playLabel: '试听 {name} 音色',
        playFailed: '浏览器拦截了音频播放，请再点一次。'
      },
      hero: {
        tagline: '您的私人朗读助手',
        title: '为我朗读：文字转自然语音',
        description: '使用我们的AI语音技术将任何文本转换为自然语音。适用于学习、无障碍访问和随时随地的内容消费。'
      },
      benefits: {
        title: '为什么选择为我朗读',
        items: {
          quality: { title: '自然语音', description: '具有自然语调和节奏的逼真语音' },
          styles: { title: '多语言支持', description: '支持超过50种语言和口音' },
          speed: { title: '即时转换', description: '几秒钟内完成文本转语音' },
          batch: { title: '无障碍优先', description: '让所有人都能访问内容' }
        }
      },
      features: {
        title: '为我朗读功能',
        items: {
          styleTransfer: { title: '语音定制', description: '调整速度、音调和情感以满足您的需求' },
          customPrompts: { title: '文档支持', description: '转换PDF、Word和其他文档格式' },
          batchProcessing: { title: '批量处理', description: '同时转换多个文档' },
          highResolution: { title: '音频导出', description: '下载MP3、WAV等格式' }
        }
      },
      howItWorks: {
        title: '如何转换文字为语音',
        steps: {
          upload: { number: '01', title: '输入文本', description: '粘贴文本' },
          style: { number: '02', title: '选择语音', description: '选择语言和语音设置' },
          generate: { number: '03', title: '生成音频', description: '即时转换文本为语音' },
          download: { number: '04', title: '保存与分享', description: '下载或分享您的音频文件' }
        }
      },
      faq: {
        title: '常见问题',
        items: [
          { question: '文字转语音是如何工作的？', answer: '我们的AI技术使用先进的神经网络将文本转换为自然语音。' },
          { question: '支持哪些语言？', answer: '我们支持超过50种语言，主要语言还提供多种口音选择。' },
          { question: '服务是免费的吗？', answer: '是的，基本的文本转语音功能是免费的，但有时长限制。' },
          { question: '支持哪些文件格式？', answer: '可以粘贴文本，或上传 TXT、Markdown、HTML、RTF、CSV、PDF、DOCX、ODT、EPUB。旧版 .doc 请先另存为 .docx。' },
          { question: '可以下载音频文件吗？', answer: '是的，您可以下载MP3、WAV等常用格式的音频文件。' }
        ]
      },
      cta: {
        title: '准备为您的文本配音了吗？',
        description: '使用我们的AI技术将文本转换为自然语音',
        button: '立即开始转换'
      },
      footer: {
        product: '产品', features: '功能', support: '支持',
        rights: '版权所有',
        engines: '免费音色：Web Speech · 云端音色（规划中）：Atlas Cloud 上的 xAI TTS v1 与 MiniMax Speech 2.6 Turbo'
      },
      pricing: {
        metaTitle: '定价 — 为我朗读',
        eyebrow: '定价',
        title: '为收听时长付费，而不是为软件付费',
        subtitle: '浏览器自带的音色永久免费。付费套餐增加云端 AI 音色，按可收听的小时数计量。',
        yearly: '年付',
        monthly: '月付',
        save: '省 22%',
        perMonth: '/ 月',
        billedYearly: '按 {amount} 每年一次性收取',
        billedMonthly: '按月收取，可随时取消',
        popular: '最受欢迎',
        free: {
          name: '免费版',
          tagline: '无需注册即可开始',
          forever: '永久免费',
          cta: '开始朗读',
          f1: '浏览器音色，无限使用',
          f2: '云端音色 10 分钟，仅一次',
          f3: '逐句高亮，并记住上次听到哪里',
          f4: '粘贴文本或上传文档'
        },
        plus: {
          name: 'Plus',
          tagline: '适合日常的收听习惯',
          cta: '选择 Plus',
          f1: '云端 AI 音色每月 8 小时',
          f2: 'Expressive 每分钟按 3 分钟扣',
          f3: '包含免费版全部功能',
          f4: '重听永远不消耗额度'
        },
        pro: {
          name: 'Pro',
          tagline: '适合长篇书籍与高强度收听',
          cta: '选择 Pro',
          f1: '云端 AI 音色每月 16 小时',
          f2: 'Expressive 每分钟按 3 分钟扣',
          f3: '合成优先队列',
          f4: '额度用尽可购买加油包'
        },
        voices: {
          title: '三种音色',
          subtitle: '各档的差别在于包含多少云端语音，而不是朗读器能做什么。',
          basicT: 'Basic',
          basicD: '您设备上已有的音色。永久免费，无需账号，没有上限。',
          naturalT: 'Natural',
          naturalD: '用于日常收听的云端 AI 音色——长文章和整本书。',
          expressiveT: 'Expressive',
          expressiveD: '带情绪与音高控制。每听 1 分钟，从 AI 时长里扣 3 分钟。'
        },
        packs: {
          title: '月中就用完了？',
          subtitle: '一份 +10 小时加油包，补的是 Plus / Pro 共用的那份 AI 时长。',
          hours: 'AI 音色 +10 小时',
          natural: 'AI 音色 +10 小时',
          expressive: 'AI 音色 +10 小时',
          buy: '加入套餐',
          rule: '需要有效套餐 · 仅在月度额度用尽后消耗 · 12 个月内有效',
          needPlan: '加油包需要有效套餐——请先订阅。'
        },
        notes: {
          title: '需要知道的几件事',
          n1: '月度时长每个计费周期重置，未用完的部分不结转。',
          n2: 'Natural 听 1 小时扣 1 小时，Expressive 按 3 倍扣。任何语言下可听时长相同。',
          n3: '音频导出仍在规划中，尚未包含在任何套餐里。',
          n4: '本页为原型，不会真实收款，也不会创建套餐。'
        }
      },
      auth: {
        signIn: '登录',
        signOut: '退出登录',
        continueGoogle: '使用 Google 继续',
        signInTitle: '登录为我朗读',
        signInSubtitle: '登录后可解锁高级 AI 音色，并在多设备同步您的阅读内容。',
        signInNote: '仅为原型演示——不会创建真实账号。正式版使用 Google 登录。',
        backHome: '← 返回首页',
        plan: '套餐',
        planFree: '免费版',
        usage: '用量',
        billing: '账单',
        signedInAs: '当前登录',
        usageNote: '免费版：浏览器音色不限量。高级音色字符：已用 0。'
      },
      reader: {
        heading: '朗读器',
        sub: '粘贴文本、选择音色，边听边跟读。文本与播放位置会记在本浏览器中。',
        placeholder: '粘贴您想听的文本…',
        clear: '清空文本',
        upload: '上传文档',
        smaller: '缩小字号',
        bigger: '放大字号',
        play: '播放',
        pause: '暂停',
        stop: '停止',
        speed: '播放速度',
        openFull: '打开完整朗读器 →',
        tabPlayback: '播放',
        tabPronunciation: '发音',
        language: '朗读语言',
        voiceSelection: '音色选择',
        filterAll: '全部',
        filterFree: '免费',
        filterPro: '高级',
        allLanguages: '全部语言',
        groupCloud: '云端音色',
        groupBrowser: '浏览器音色',
        seePlans: '查看方案 →',
        systemVoice: '系统语音',
        note: '免费音色来自您的浏览器，不限用量。高级 AI 音色计划接入 Atlas Cloud MiniMax。',
        words: '词',
        characters: '字符',
        noVoices: '没有符合该筛选的音色。',
        needText: '请先输入文本——粘贴一篇文章或上传文档。',
        needTxt: '不支持该文件类型。请尝试 TXT、MD、HTML、PDF、DOCX、ODT 或 EPUB。',
        needFormat: '不支持该文件类型。请尝试 TXT、MD、HTML、PDF、DOCX、ODT 或 EPUB。',
        needDocx: '不支持旧版 .doc，请另存为 .docx 后再试。',
        emptyFile: '这个文件里没有可读文本。',
        tooLarge: '文件太大（上限 15 MB）。',
        parseFailed: '无法读取该文件。',
        loaded: '已载入',
        blocked: '浏览器拦截了音频播放，请再点一次播放。',
        noSpeech: '此浏览器不支持 Web Speech——文本编辑仍可使用。',
        premiumSignIn: '云端音色需要付费套餐，请先登录，再到定价页选择方案。',
        premiumUpgrade: '云端音色需要付费套餐，详见定价页。本原型未接入支付。'
      },
      sample:
        '欢迎使用「为我朗读」。\n\n' +
        '点击播放，这段文字就会用自然的语音、按您选择的语速念给您听。\n\n' +
        '想听什么都可以：粘贴一篇文章、上传一份文档，或者写下自己的笔记。\n\n' +
        '朗读时，当前这句会高亮显示，方便您跟着一起看。\n\n' +
        '在下方播放器里试试不同的音色和语速吧。'
    }
  };

  var LANGS = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'zh', label: '中文', flag: '🇨🇳' }
  ];

  function getLang() {
    try {
      var l = global.localStorage.getItem(LANG_KEY);
      return l === 'zh' || l === 'en' ? l : 'en';
    } catch (e) { return 'en'; }
  }

  function resolve(dict, path) {
    return path.split('.').reduce(function (acc, k) {
      return acc == null ? undefined : acc[k];
    }, dict);
  }

  function t(path) {
    var v = resolve(DICT[getLang()], path);
    if (v === undefined) v = resolve(DICT.en, path);
    return v === undefined ? path : v;
  }

  function setLang(code) {
    try { global.localStorage.setItem(LANG_KEY, code); } catch (e) {}
    apply();
    global.dispatchEvent(new CustomEvent('rtm:langchange', { detail: { lang: code } }));
  }

  /* data-i18n="path"        → textContent
     data-i18n-html="path"   → innerHTML (for copy holding inline markup)
     data-i18n-attr="title:path,aria-label:path" */
  function apply() {
    var lang = getLang();
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');

    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-html]'), function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-attr]'), function (el) {
      el.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var bits = pair.split(':');
        if (bits.length === 2) el.setAttribute(bits[0].trim(), t(bits[1].trim()));
      });
    });

    var titleKey = document.body.getAttribute('data-title-key') || 'meta.title';
    document.title = t(titleKey);
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', t('meta.description'));
  }

  /* language switcher in the nav */
  function mountLangSwitch(host) {
    function render() {
      var cur = getLang();
      var active = LANGS.filter(function (l) { return l.code === cur; })[0];
      host.innerHTML =
        '<div class="lang-switch">' +
          '<button class="lang-btn" aria-haspopup="true" aria-expanded="false">' +
            '<span>' + active.flag + '</span><span>' + active.label + '</span>' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>' +
          '</button>' +
          '<div class="lang-menu" hidden>' +
            LANGS.map(function (l) {
              return '<button class="lang-item' + (l.code === cur ? ' active' : '') + '" data-lang="' + l.code + '">' +
                '<span>' + l.flag + '</span><span>' + l.label + '</span></button>';
            }).join('') +
          '</div>' +
        '</div>';

      var btn = host.querySelector('.lang-btn');
      var menu = host.querySelector('.lang-menu');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
        btn.setAttribute('aria-expanded', String(!menu.hidden));
      });
      host.querySelectorAll('.lang-item').forEach(function (item) {
        item.addEventListener('click', function () {
          setLang(item.getAttribute('data-lang'));
          render();
        });
      });
      document.addEventListener('click', function () { menu.hidden = true; });
    }
    render();
  }

  global.RTMI18n = { t: t, getLang: getLang, setLang: setLang, apply: apply, mountLangSwitch: mountLangSwitch, LANGS: LANGS };
})(window);
