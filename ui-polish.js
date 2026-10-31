/*
 * 刷题站 · 界面微调脚本
 * --------------------------------------------------------------
 * 1. 删掉「使用说明」页里没用到的「关于记录」段落（源码不在服务器上，只能在渲染后处理）；
 *    React 路由切换会重新渲染，所以挂一个轻量的 MutationObserver 兜底。
 * 2. 给内容页外层加一个标记类，方便样式表针对「内容压在壁纸上」的页面做统一处理。
 * 脚本必须同源加载（CSP script-src 'self'）。
 */
(function () {
  'use strict';

  var REMOVED_SECTION_TITLES = ['关于记录', '关于本站', '关于', '高松灯', '陪伴角色'];

  function normalize(text) {
    return (text || '').replace(/\s+/g, '');
  }

  function pruneGuide() {
    var card = document.querySelector('.guide-card');
    if (!card) return false;

    var changed = false;
    var headings = card.querySelectorAll('h2, h3');
    for (var i = 0; i < headings.length; i += 1) {
      var heading = headings[i];
      var title = normalize(heading.textContent);
      var matched = false;
      for (var t = 0; t < REMOVED_SECTION_TITLES.length; t += 1) {
        if (title.indexOf(REMOVED_SECTION_TITLES[t]) === 0) {
          matched = true;
          break;
        }
      }
      if (!matched) continue;
      var section = heading.closest('section');
      if (section && section.parentNode === card) {
        section.parentNode.removeChild(section);
        changed = true;
      }
    }
    if (changed) scrubCompanionMentions(card);
    return changed;
  }

  // 陪伴角色已经下线，说明页里的零散提及也一起抹掉
  function scrubCompanionMentions(card) {
    if (!card || !card.querySelectorAll) return;
    var walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!/陪伴/.test(node.nodeValue || '')) continue;
      node.nodeValue = node.nodeValue
        .replace(/、陪伴和/g, '和')
        .replace(/陪伴和/g, '')
        .replace(/、陪伴/g, '')
        .replace(/陪伴/g, '');
    }
  }

  // 用户手动展开/点击锚点后就保持展开，避免 React 重渲染后被重新折叠
  var homeExpandedByUser = false;

  // 首页板块太多：默认只留前两个，其余折叠到一个“展开”按钮后面
  function collapseHomeSections() {
    if (homeExpandedByUser) return;
    var col = document.querySelector('.home-content-col');
    if (!col) return;

    var anchors = [];
    for (var i = 0; i < col.children.length; i += 1) {
      if (col.children[i].classList && col.children[i].classList.contains('home-anchor')) {
        anchors.push(col.children[i]);
      }
    }
    if (anchors.length < 4) return;
    if (col.getAttribute('data-ui-collapsed')) return;

    col.setAttribute('data-ui-collapsed', '1');
    col.classList.add('ui-home-collapsed');

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'ui-home-expand';
    button.textContent = '展开其余 ' + (anchors.length - 2) + ' 个板块';
    button.addEventListener('click', function () {
      expandHomeSections();
    });
    anchors[2].parentNode.insertBefore(button, anchors[2]);
  }

  function expandHomeSections() {
    homeExpandedByUser = true;
    var col = document.querySelector('.home-content-col');
    if (!col) return;
    col.classList.remove('ui-home-collapsed');
    var button = col.querySelector('.ui-home-expand');
    if (button && button.parentNode) button.parentNode.removeChild(button);
  }

  // 侧栏「题库 / 错题收藏 / 错题分析 / AI 学习总结」指向的板块被折叠时：
  // 先展开，再滚过去，否则点了没反应（这就是 AI 学习总结按钮的 bug）。
  function expandForTarget(target) {
    if (!target) return false;
    var col = document.querySelector('.home-content-col');
    if (!col || !col.contains(target)) return false;
    if (!col.classList.contains('ui-home-collapsed')) return false;
    // 折叠用的是零高度 + visibility:hidden，offsetParent 仍然存在，要按高度判断
    var style = window.getComputedStyle(target);
    var hidden = style.display === 'none' || style.visibility === 'hidden' || target.getBoundingClientRect().height === 0;
    if (!hidden) return false;
    expandHomeSections();
    return true;
  }

  function syncHashTarget() {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    var target = document.getElementById(hash.slice(1));
    if (!target) return;
    if (expandForTarget(target)) {
      window.requestAnimationFrame(function () {
        if (target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  function markShell() {
    var main = document.querySelector('.app-main');
    if (!main) return;
    // 内容页（有壁纸、有卡片）统一标记，便于样式统一留白
    var isContentPage = !!document.querySelector('.guide-card, .leaderboard-page, .friends-page, .feedback-page, .account-page, .import-page, .coding-page');
    main.classList.toggle('ui-content-page', isContentPage);
  }

  function tick() {
    pruneGuide();
    collapseHomeSections();
    syncHashTarget();
    markShell();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, { once: true });
  } else {
    tick();
  }

  document.addEventListener('click', function (event) {
    var node = event.target;
    while (node && node !== document && node.nodeName !== 'A') node = node.parentNode;
    if (!node || node === document || !node.getAttribute) return;
    var href = node.getAttribute('href') || '';
    var index = href.indexOf('#');
    if (index === -1) return;
    var id = href.slice(index + 1);
    if (!id) return;

    var target = document.getElementById(id);
    if (!expandForTarget(target)) return;

    // 目标本来被折叠：先展开，再把这次点击重新发一遍。
    // 应用的高亮/滚动逻辑在“折叠状态下”会算错（会高亮到最后一个板块），
    // 让它只在展开后的布局里处理点击。
    event.preventDefault();
    event.stopPropagation();
    window.requestAnimationFrame(function () {
      window.setTimeout(function () {
        if (node.click) node.click();
      }, 120);
    });
  }, true);

  window.addEventListener('hashchange', function () {
    window.requestAnimationFrame(syncHashTarget);
  });

  if (window.MutationObserver) {
    var scheduled = false;
    var observer = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () {
        scheduled = false;
        tick();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
