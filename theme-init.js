/*
 * 首帧前定好主题，避免夜间模式先闪一下日间配色。
 *
 * 放在 public/ 下作为受控的外部启动脚本：生产环境的 CSP 只允许同源脚本（script-src 'self'），
 * 内联脚本会被浏览器拦截，所以这里必须是独立的同源文件，而不是 <script>…</script>。
 *
 * 判定规则必须与 website/web/lib/theme.ts 保持一致：
 * - 日间 06:00–18:59，夜间 19:00–05:59；
 * - 手动选择只在当前时段内有效，跨过切换时间点后回到时间表。
 *
 * 另外在应用挂载前先把首页整页壁纸铺到 html/body 上：
 * 壁纸是 60–110KB 的 webp，应用渲染完才开始下载，慢网下会先看到一块纯色背景（“壁纸没出来”）。
 * 这里提前预载并按当前主题直接画出来，等应用自己的壁纸层就位后再撤掉。
 */
(function () {
  var DAY_START_HOUR = 6;
  var NIGHT_START_HOUR = 19;
  var root = document.documentElement;
  var theme;

  try {
    var now = new Date();
    var hour = now.getHours();
    var period = hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR ? 'day' : 'night';

    var start = new Date(now);
    start.setHours(period === 'day' ? DAY_START_HOUR : NIGHT_START_HOUR, 0, 0, 0);
    if (start.getTime() > now.getTime()) start.setDate(start.getDate() - 1);

    var mode = localStorage.getItem('quiz.theme.mode');
    var chosenAt = localStorage.getItem('quiz.theme.modeAt');
    var manual =
      (mode === 'light' || mode === 'dark') &&
      Boolean(chosenAt) &&
      new Date(chosenAt).getTime() >= start.getTime();

    theme = manual ? mode : period === 'day' ? 'light' : 'dark';
  } catch (error) {
    theme = 'light';
  }

  root.dataset.theme = theme;

  /*
   * 从 3D 开屏（stillfloating.top）点「QUIZ / 刷题」进来时，做一段和博客一致的到站过渡：
   * 渐变幕 + STILL FLOATING / ENTERING 标签，短暂停留后淡出，页面内容同步上浮。
   * 只在带 from=portal 时启用，直接访问不打扰。
   */
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.get('from') === 'portal') {
      var arrivalStyle = document.createElement('style');
      arrivalStyle.id = 'quiz-arrival-style';
      arrivalStyle.textContent = [
        'html.quiz-arrival::after{content:"";position:fixed;inset:0;z-index:2147483000;pointer-events:none;opacity:1;',
        'background:radial-gradient(ellipse at 72% 38%,rgba(255,255,255,.5),transparent 52%),linear-gradient(135deg,#ebe7df 0%,#f3efe8 52%,#fbf9f5 100%);',
        'transition:opacity .45s cubic-bezier(.22,1,.36,1)}',
        'html.quiz-arrival[data-theme="dark"]::after{background:radial-gradient(ellipse at 72% 38%,rgba(113,135,158,.22),transparent 48%),linear-gradient(135deg,#222522 0%,#292d29 52%,#2d302d 100%)}',
        'html.quiz-arrival::before{content:"STILL FLOATING / ENTERING";position:fixed;left:50%;top:50%;z-index:2147483001;pointer-events:none;transform:translate(-50%,-50%);',
        'font:500 10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.22em;color:rgba(48,53,54,.62);transition:opacity .32s ease-out}',
        'html.quiz-arrival[data-theme="dark"]::before{color:rgba(228,229,220,.72)}',
        'html.quiz-arrival #root{opacity:0;transform:translateY(14px)}',
        'html.quiz-arrival.quiz-arrival-ready #root{opacity:1;transform:none;transition:opacity .65s ease-out,transform .75s cubic-bezier(.22,1,.36,1)}',
        'html.quiz-arrival.quiz-arrival-ready::after{opacity:0}',
        'html.quiz-arrival.quiz-arrival-ready::before{opacity:0}',
        '@media (prefers-reduced-motion: reduce){html.quiz-arrival::after,html.quiz-arrival::before,html.quiz-arrival #root{transition:none!important}}',
      ].join('');
      document.head.appendChild(arrivalStyle);
      root.classList.add('quiz-arrival');

      // 和博客一样，落地后把 from/theme 参数从地址栏清掉，刷新不会重复播过渡
      try {
        params.delete('from');
        params.delete('theme');
        var rest = params.toString();
        window.history.replaceState(null, '', window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
      } catch (error) {}

      var revealArrival = function () {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            window.setTimeout(function () {
              root.classList.add('quiz-arrival-ready');
              window.setTimeout(function () {
                root.classList.remove('quiz-arrival', 'quiz-arrival-ready');
              }, 1000);
            }, 60);
          });
        });
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', revealArrival, { once: true });
      } else {
        revealArrival();
      }
    }
  } catch (error) {
    /* 到站动效失败不影响页面 */
  }

  try {
    var isHome = window.location.pathname === '/' || window.location.pathname === '/index.html';
    if (!isHome) return;

    var isMobile = window.matchMedia('(max-width: 767px)').matches;
    var url =
      '/images/' +
      (isMobile
        ? theme === 'dark'
          ? 'home-night-mobile'
          : 'home-day-mobile'
        : theme === 'dark'
          ? 'home-night-desktop'
          : 'home-day-desktop') +
      '.webp';

    var preload = document.createElement('link');
    preload.rel = 'preload';
    preload.as = 'image';
    preload.href = url;
    document.head.appendChild(preload);

    var bootStyle = document.createElement('style');
    bootStyle.textContent =
      'html.quiz-wallpaper-boot,html.quiz-wallpaper-boot body{' +
      'background-image:url("' + url + '");' +
      'background-position:center ' + (isMobile ? 'top' : 'center') + ';' +
      'background-size:cover;background-repeat:no-repeat}' +
      '/* 首帧期间只留当前主题的壁纸层，别让另一张白下载、也别抢带宽 */' +
      'html.quiz-wallpaper-boot[data-theme="dark"] .wallpaper-day,' +
      'html.quiz-wallpaper-boot[data-theme="light"] .wallpaper-night{display:none!important}';
    document.head.appendChild(bootStyle);
    root.classList.add('quiz-wallpaper-boot');

    var finished = false;
    var finish = function () {
      if (finished) return;
      finished = true;
      root.classList.remove('quiz-wallpaper-boot');
    };

    var decoded = false;
    var markDecoded = function () {
      decoded = true;
    };
    var probe = new Image();
    probe.src = url;
    if (probe.decode) probe.decode().then(markDecoded, markDecoded);
    else probe.onload = markDecoded;

    var startedAt = Date.now();
    var timer = window.setInterval(function () {
      var appMounted =
        document.querySelector('#root') && document.querySelector('#root').children.length > 0;
      if ((decoded && appMounted) || Date.now() - startedAt > 6000) {
        window.clearInterval(timer);
        // 先让应用自己的壁纸层画一帧，再撤首帧背景
        window.requestAnimationFrame(function () {
          window.setTimeout(finish, 120);
        });
      }
    }, 80);

    // 应用一接管主题（说明它已经按自己的状态渲染了），立刻交还背景控制权
    if (window.MutationObserver) {
      var observer = new MutationObserver(function () {
        if (root.dataset.theme !== theme) {
          observer.disconnect();
          finish();
        }
      });
      observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }
  } catch (error) {
    /* 壁纸预热失败不影响页面本身 */
  }
})();
