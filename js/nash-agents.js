/* ============================================================
   nash-agents.js
   دو agent یکپارچه برای Nash Graphic:
   ① Content Agent  — واردکردن مطالب به بلاگ (فقط ادمین)
   ② Support Agent  — چت پشتیبانی هوشمند (همه کاربران)

   ✅ بدون سرور — فقط Supabase + GitHub Pages
   ✅ بدون API key خارجی — Claude API از طریق مرورگر صدا زده می‌شود
      (چت از decision tree محلی استفاده می‌کند، نیاز به کلید ندارد)
   ============================================================ */

(function () {
  'use strict';

  /* ════════════════════════════════════════════════════════════
     0. WAIT FOR APP BOOTSTRAP
     ════════════════════════════════════════════════════════════ */
  function whenReady(fn) {
    // config.js باید قبلاً لود شده باشد (supabase و State موجود باشند)
    if (typeof supabase !== 'undefined' && typeof State !== 'undefined') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  /* ════════════════════════════════════════════════════════════
     1. SHARED STYLES
     ════════════════════════════════════════════════════════════ */
  const STYLE = `
    /* ── Support Chat Button ── */
    #na-chat-btn {
      position: fixed; bottom: 24px; left: 24px; z-index: 9000;
      width: 52px; height: 52px; border-radius: 50%;
      background: linear-gradient(135deg,#c8a96e,#a07840);
      border: none; cursor: pointer;
      box-shadow: 0 4px 18px rgba(200,169,110,.4);
      font-size: 22px; display: flex; align-items: center; justify-content: center;
      transition: transform .2s, box-shadow .2s;
    }
    #na-chat-btn:hover { transform: scale(1.08); box-shadow: 0 6px 26px rgba(200,169,110,.55); }
    #na-chat-badge {
      position: absolute; top: -2px; right: -2px;
      width: 14px; height: 14px; background: #ef5350; border-radius: 50%;
      border: 2px solid #0f0f0f; animation: na-pulse 2s infinite;
    }

    /* ── Chat Panel ── */
    #na-chat-panel {
      position: fixed; bottom: 86px; left: 24px; z-index: 9001;
      width: 330px; max-width: calc(100vw - 32px);
      height: 460px; max-height: calc(100vh - 110px);
      background: #161616; border: 1px solid #2a2a2a;
      border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,.6);
      display: flex; flex-direction: column; overflow: hidden;
      font-family: 'Vazirmatn','Segoe UI',Tahoma,sans-serif;
      transform: scale(.92) translateY(12px); opacity: 0; pointer-events: none;
      transition: transform .22s cubic-bezier(.34,1.56,.64,1), opacity .18s ease;
    }
    #na-chat-panel.na-open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }

    .na-head {
      background: linear-gradient(135deg,#1e1a14,#2a2218);
      padding: 12px 14px; display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid #2a2a2a; flex-shrink: 0;
    }
    .na-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: linear-gradient(135deg,#c8a96e,#a07840);
      display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0;
    }
    .na-head-name { font-size: 13px; font-weight: 700; color: #e8e8e8; }
    .na-head-status { font-size: 11px; color: #4caf50; display: flex; align-items: center; gap: 4px; }
    .na-head-status::before {
      content:''; width:6px; height:6px; border-radius:50%;
      background:#4caf50; display:inline-block; animation: na-pulse 2s infinite;
    }
    .na-close-btn {
      background: none; border: none; color: #666; font-size: 17px;
      cursor: pointer; padding: 4px; margin-right: auto;
    }

    /* context bar */
    #na-ctx-bar {
      background: #1a1510; border-bottom: 1px solid #2a2a2a;
      padding: 6px 14px; font-size: 11px; color: #c8a96e;
      display: none; align-items: center; gap: 6px;
    }
    #na-ctx-bar.na-visible { display: flex; }

    /* messages */
    .na-msgs {
      flex: 1; overflow-y: auto; padding: 12px; display: flex;
      flex-direction: column; gap: 8px; scroll-behavior: smooth;
    }
    .na-msgs::-webkit-scrollbar { width: 3px; }
    .na-msgs::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

    .na-msg {
      max-width: 86%; padding: 8px 12px; border-radius: 12px;
      font-size: 12.5px; line-height: 1.6; animation: na-fadein .18s ease;
    }
    .na-msg.bot {
      background: #222; color: #e0e0e0; border-bottom-right-radius: 4px; align-self: flex-end;
    }
    .na-msg.user {
      background: rgba(200,169,110,.12); border: 1px solid rgba(200,169,110,.2);
      color: #e8e8e8; border-bottom-left-radius: 4px; align-self: flex-start;
    }
    .na-msg-time { font-size: 10px; color: #555; margin-top: 2px; }

    /* typing */
    .na-typing {
      display: flex; gap: 4px; align-items: center;
      padding: 9px 13px; background: #222; border-radius: 12px;
      align-self: flex-end; max-width: 55px; animation: na-fadein .18s ease;
    }
    .na-typing span {
      width: 5px; height: 5px; border-radius: 50%; background: #c8a96e;
      animation: na-bounce 1.2s infinite;
    }
    .na-typing span:nth-child(2) { animation-delay: .2s; }
    .na-typing span:nth-child(3) { animation-delay: .4s; }

    /* quick replies */
    .na-qrs { display: flex; flex-wrap: wrap; gap: 5px; padding: 0 12px 6px; }
    .na-qr {
      background: #1e1e1e; border: 1px solid #333; border-radius: 18px;
      padding: 4px 11px; font-size: 11px; color: #c8a96e;
      cursor: pointer; transition: background .14s, border-color .14s;
      font-family: inherit; white-space: nowrap;
    }
    .na-qr:hover { background: rgba(200,169,110,.15); border-color: rgba(200,169,110,.4); }

    /* input row */
    .na-input-row {
      padding: 9px 11px; border-top: 1px solid #222;
      display: flex; gap: 7px; flex-shrink: 0;
    }
    .na-input {
      flex: 1; background: #1e1e1e; border: 1px solid #2a2a2a;
      border-radius: 20px; padding: 7px 13px; color: #e8e8e8;
      font-size: 12.5px; outline: none; font-family: inherit;
      direction: rtl; transition: border-color .14s;
    }
    .na-input:focus { border-color: rgba(200,169,110,.4); }
    .na-send {
      width: 34px; height: 34px; border-radius: 50%;
      background: linear-gradient(135deg,#c8a96e,#a07840);
      border: none; cursor: pointer; display: flex;
      align-items: center; justify-content: center; font-size: 15px;
      transition: transform .14s; flex-shrink: 0;
    }
    .na-send:hover { transform: scale(1.08); }

    /* ── Content Agent Panel (admin only) ── */
    #na-content-panel {
      position: fixed; bottom: 86px; right: 24px; z-index: 9001;
      width: 340px; max-width: calc(100vw - 32px);
      max-height: calc(100vh - 110px);
      background: #161616; border: 1px solid #2a2a2a;
      border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,.6);
      display: flex; flex-direction: column; overflow: hidden;
      font-family: 'Vazirmatn','Segoe UI',Tahoma,sans-serif;
      transform: scale(.92) translateY(12px); opacity: 0; pointer-events: none;
      transition: transform .22s cubic-bezier(.34,1.56,.64,1), opacity .18s ease;
    }
    #na-content-panel.na-open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }

    #na-content-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9000;
      width: 52px; height: 52px; border-radius: 50%;
      background: linear-gradient(135deg,#6e8ec8,#405ea0);
      border: none; cursor: pointer;
      box-shadow: 0 4px 18px rgba(110,142,200,.4);
      font-size: 20px; display: flex; align-items: center; justify-content: center;
      transition: transform .2s; display: none;
    }
    #na-content-btn:hover { transform: scale(1.08); }

    .na-ca-head {
      background: linear-gradient(135deg,#141820,#1e2430);
      padding: 12px 14px; display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid #2a2a2a; flex-shrink: 0;
    }
    .na-ca-title { font-size: 13px; font-weight: 700; color: #e8e8e8; flex: 1; }
    .na-ca-body { overflow-y: auto; padding: 14px; flex: 1; }
    .na-ca-body::-webkit-scrollbar { width: 3px; }
    .na-ca-body::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

    .na-field-label { font-size: 11px; color: #888; margin-bottom: 4px; display: block; }
    .na-field {
      width: 100%; background: #111; border: 1px solid #2a2a2a;
      border-radius: 7px; padding: 7px 10px; color: #e8e8e8;
      font-size: 12.5px; box-sizing: border-box; outline: none;
      font-family: inherit; direction: ltr; transition: border-color .14s;
      margin-bottom: 10px;
    }
    .na-field:focus { border-color: rgba(110,142,200,.5); }
    select.na-field { cursor: pointer; }

    .na-btn {
      width: 100%; padding: 9px; border: none; border-radius: 8px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      font-family: inherit; display: flex; align-items: center;
      justify-content: center; gap: 6px; transition: opacity .15s;
    }
    .na-btn:disabled { opacity: .5; cursor: not-allowed; }
    .na-btn-blue { background: #4a70c0; color: #fff; }
    .na-btn-green { background: #3d9e4a; color: #fff; margin-top: 8px; }

    .na-progress-bar {
      height: 5px; background: #2a2a2a; border-radius: 3px;
      overflow: hidden; margin: 8px 0;
    }
    .na-progress-fill {
      height: 100%; background: #6e8ec8; border-radius: 3px;
      transition: width .4s ease; width: 0%;
    }

    .na-article-list { max-height: 160px; overflow-y: auto; margin: 8px 0; }
    .na-article-list::-webkit-scrollbar { width: 3px; }
    .na-article-list::-webkit-scrollbar-thumb { background: #2a2a2a; }
    .na-article-item {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 5px; border-radius: 6px; cursor: pointer;
      font-size: 11.5px; color: #ccc; transition: background .13s;
    }
    .na-article-item:hover { background: #1e1e1e; }
    .na-article-item.selected { background: rgba(110,142,200,.12); color: #e8e8e8; }
    .na-article-cb {
      width: 14px; height: 14px; border-radius: 3px; flex-shrink: 0;
      border: 2px solid #444; background: transparent; display: flex;
      align-items: center; justify-content: center; transition: all .13s;
    }
    .na-article-item.selected .na-article-cb {
      background: #6e8ec8; border-color: #6e8ec8;
    }

    .na-log {
      background: #111; border-radius: 8px; padding: 10px;
      max-height: 130px; overflow-y: auto; margin-top: 10px;
      font-size: 11px; color: #888; font-family: monospace;
    }
    .na-log::-webkit-scrollbar { width: 3px; }
    .na-log::-webkit-scrollbar-thumb { background: #2a2a2a; }
    .na-log-line { margin-bottom: 3px; animation: na-fadein .15s ease; }
    .na-log-ok  { color: #4caf50; }
    .na-log-err { color: #ef5350; }
    .na-log-warn{ color: #ff9800; }

    /* ── Animations ── */
    @keyframes na-pulse {
      0%,100% { opacity:1; } 50% { opacity:.5; }
    }
    @keyframes na-bounce {
      0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-4px); }
    }
    @keyframes na-fadein {
      from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); }
    }
  `;

  /* ════════════════════════════════════════════════════════════
     2. SUPPORT CHAT AGENT (decision tree — بدون API key)
     ════════════════════════════════════════════════════════════ */
  const SupportAgent = (() => {

    /* ── Decision Tree ─────────────────────────────────────── */
    const TREE = {
      root: {
        msg: 'سلام! 👋 به پشتیبانی Nash Graphic خوش اومدی. چطور می‌تونم کمکت کنم؟',
        opts: [
          { label: '🛒 فرآیند سفارش',   next: 'order_flow'    },
          { label: '📦 پیگیری سفارش',   next: 'tracking'      },
          { label: '💰 قیمت و پرداخت', next: 'payment'       },
          { label: '🎨 محصولات',        next: 'products'      },
          { label: '📞 تماس با ادمین',  next: 'contact_admin' },
        ]
      },
      order_flow: {
        msg: 'فرآیند سفارش در Nash Graphic اینطوریه:\n\n۱. طرح یا سرویس مورد نظر رو به سبد خرید اضافه کن\n۲. روی «ثبت سفارش» کلیک کن و اطلاعاتت رو پر کن\n۳. ادمین درخواست رو بررسی می‌کنه\n۴. از طریق تلگرام/بله/روبیکا باهات تماس می‌گیریم\n۵. پس از توافق، سفارش نهایی میشه و ارسال میشه\n\nسوال دیگه‌ای داری؟',
        opts: [
          { label: '⏱ چقدر طول می‌کشه؟', next: 'delivery_time' },
          { label: '📄 چه فایلی لازمه؟',  next: 'file_info'    },
          { label: '🔙 منوی اصلی',        next: 'root'         },
        ]
      },
      tracking: {
        msg: null, // dynamic — از Supabase می‌خونه
        dynamic: 'fetch_orders',
        opts: [
          { label: '🔙 منوی اصلی', next: 'root' },
        ]
      },
      payment: {
        msg: 'درباره پرداخت:\n\n• پرداخت در Nash Graphic پس از توافق با ادمین انجام میشه\n• روش پرداخت (کارت به کارت / آنلاین / نقدی) توسط ادمین اعلام میشه\n• تا قبل از تأیید ادمین هیچ مبلغی دریافت نمیشه\n• فاکتور رسمی پس از نهایی شدن سفارش صادر میشه',
        opts: [
          { label: '💳 کارت به کارت',   next: 'card2card'    },
          { label: '🔙 منوی اصلی',      next: 'root'         },
        ]
      },
      card2card: {
        msg: 'برای پرداخت کارت به کارت:\n\n• شماره کارت توسط ادمین از طریق پیام‌رسان ارسال میشه\n• پس از واریز، تصویر رسید رو برای ادمین بفرست\n• سفارش پس از تأیید واریز پردازش میشه',
        opts: [{ label: '🔙 منوی اصلی', next: 'root' }]
      },
      products: {
        msg: 'Nash Graphic این خدمات رو ارائه میده:\n\n🎨 طرح‌های گرافیکی (لوگو، بروشور، بنر و...)\n🖨️ چاپ انواع محصولات\n📦 پکیج‌های عمده برای چاپخانه‌ها\n\nبرای قیمت دقیق هر محصول، با ادمین تماس بگیر یا طرح رو به سبد اضافه کن.',
        opts: [
          { label: '💰 قیمت‌ها',       next: 'payment'      },
          { label: '📞 تماس ادمین',    next: 'contact_admin' },
          { label: '🔙 منوی اصلی',     next: 'root'         },
        ]
      },
      delivery_time: {
        msg: 'زمان تحویل بستگی به نوع سفارش داره:\n\n• طرح گرافیکی: ۲–۵ روز کاری\n• چاپ ساده: ۳–۷ روز کاری\n• پکیج‌های عمده: ۷–۱۴ روز کاری\n\nادمین پس از بررسی، زمان دقیق رو اعلام می‌کنه.',
        opts: [{ label: '🔙 منوی اصلی', next: 'root' }]
      },
      file_info: {
        msg: 'فایل‌های مورد نیاز برای سفارش:\n\n• فرمت‌های قابل قبول: AI، PDF، PSD، PNG (با کیفیت بالا)\n• رزولوشن برای چاپ: حداقل ۳۰۰ DPI\n• رنگ: CMYK برای چاپ\n\nاگه فایل آماده نداری، طراحان Nash Graphic می‌تونن کمک کنن.',
        opts: [{ label: '🔙 منوی اصلی', next: 'root' }]
      },
      contact_admin: {
        msg: 'برای تماس مستقیم با ادمین Nash Graphic:\n\n📱 تلگرام: از طریق سیستم سفارش پیام میشه\n📧 ایمیل: از صفحه «پشتیبانی» تیکت ثبت کن\n\nمعمولاً ظرف ۲–۴ ساعت در ساعات کاری پاسخ داده میشه.',
        opts: [
          { label: '📝 ثبت تیکت', action: 'go_support' },
          { label: '🔙 منوی اصلی', next: 'root'        },
        ]
      },
    };

    /* ── fetch orders از Supabase ──────────────────────────── */
    const STATUS_FA = {
      pending_review: 'در انتظار بررسی ادمین ⏳',
      contacted:      'ادمین تماس گرفته ✅',
      processing:     'در حال آماده‌سازی 🔧',
      shipped:        'ارسال شده 🚚',
      delivered:      'تحویل داده شده ✅',
      cancelled:      'لغو شده ❌',
    };

    async function fetchUserOrders() {
      if (!State.user) return null;
      try {
        const { data } = await supabase
          .from('orders')
          .select('id,tracking_code,status,created_at,final_amount,items')
          .eq('user_id', State.user.id)
          .order('created_at', { ascending: false })
          .limit(3);
        return data || [];
      } catch { return []; }
    }

    function formatOrderMsg(orders) {
      if (!orders || !orders.length) {
        return 'سفارشی در حساب شما یافت نشد.\n\nاگه سفارش داری، با کد پیگیری از صفحه «پیگیری سفارش» وضعیتش رو چک کن.';
      }
      const lines = orders.map(o => {
        const date = new Date(o.created_at).toLocaleDateString('fa-IR');
        const status = STATUS_FA[o.status] || o.status;
        const amount = (o.final_amount || 0).toLocaleString('fa-IR') + ' تومان';
        return `🔹 سفارش #${o.tracking_code || o.id.slice(0,8)}\n   وضعیت: ${status}\n   تاریخ: ${date} | مبلغ: ${amount}`;
      });
      return `آخرین سفارش‌های شما:\n\n${lines.join('\n\n')}`;
    }

    /* ── DOM ────────────────────────────────────────────────── */
    let isOpen = false;
    let context = {};

    function injectDOM() {
      document.body.insertAdjacentHTML('beforeend', `
        <button id="na-chat-btn" title="پشتیبانی">
          🎨<span id="na-chat-badge"></span>
        </button>
        <div id="na-chat-panel" dir="rtl">
          <div class="na-head">
            <div class="na-avatar">🤖</div>
            <div>
              <div class="na-head-name">دستیار Nash Graphic</div>
              <div class="na-head-status">آنلاین</div>
            </div>
            <button class="na-close-btn" id="na-chat-close">✕</button>
          </div>
          <div id="na-ctx-bar"><span>📦</span><span id="na-ctx-text"></span></div>
          <div class="na-msgs" id="na-msgs"></div>
          <div class="na-qrs" id="na-qrs"></div>
          <div class="na-input-row">
            <input class="na-input" id="na-input" placeholder="پیام بنویسید..." />
            <button class="na-send" id="na-send">➤</button>
          </div>
        </div>
      `);

      document.getElementById('na-chat-btn').onclick = toggle;
      document.getElementById('na-chat-close').onclick = close;
      document.getElementById('na-send').onclick = sendUser;
      document.getElementById('na-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); sendUser(); }
      });
    }

    function now() {
      return new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    }

    function addMsg(text, who = 'bot') {
      const msgs = document.getElementById('na-msgs');
      const div = document.createElement('div');
      div.className = `na-msg ${who}`;
      div.innerHTML = text.replace(/\n/g, '<br>') +
        `<div class="na-msg-time">${now()}</div>`;
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
    }

    function showTyping() {
      const msgs = document.getElementById('na-msgs');
      const el = document.createElement('div');
      el.className = 'na-typing'; el.id = 'na-typing';
      el.innerHTML = '<span></span><span></span><span></span>';
      msgs.appendChild(el);
      msgs.scrollTop = msgs.scrollHeight;
    }
    function hideTyping() { document.getElementById('na-typing')?.remove(); }

    function renderOpts(opts) {
      const c = document.getElementById('na-qrs');
      c.innerHTML = '';
      (opts || []).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'na-qr';
        btn.textContent = opt.label;
        btn.onclick = () => {
          c.innerHTML = '';
          addMsg(opt.label, 'user');
          if (opt.action === 'go_support') {
            setTimeout(() => {
              close();
              if (typeof Router !== 'undefined') Router.navigate('support');
            }, 400);
          } else if (opt.next) {
            setTimeout(() => goNode(opt.next), 400);
          }
        };
        c.appendChild(btn);
      });
    }

    async function goNode(key) {
      const node = TREE[key];
      if (!node) return;
      showTyping();
      await delay(600);
      hideTyping();

      if (node.dynamic === 'fetch_orders') {
        const orders = await fetchUserOrders();
        addMsg(formatOrderMsg(orders));
      } else {
        addMsg(node.msg || '');
      }
      renderOpts(node.opts);
    }

    function sendUser() {
      const input = document.getElementById('na-input');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      addMsg(text, 'user');
      document.getElementById('na-qrs').innerHTML = '';
      // keyword matching
      setTimeout(() => {
        const lower = text.toLowerCase();
        if (/سفارش|خرید|order/i.test(lower))         goNode('order_flow');
        else if (/پیگیری|tracking|وضعیت/i.test(lower)) goNode('tracking');
        else if (/قیمت|پرداخت|price|pay/i.test(lower)) goNode('payment');
        else if (/فایل|file|فرمت/i.test(lower))        goNode('file_info');
        else if (/تماس|ادمین|contact/i.test(lower))    goNode('contact_admin');
        else if (/محصول|طرح|چاپ/i.test(lower))         goNode('products');
        else {
          addMsg('متوجه سوالت نشدم. لطفاً از گزینه‌های زیر انتخاب کن یا سوالت رو ساده‌تر بنویس.');
          goNode('root').then(() => {});
        }
      }, 300);
    }

    function open() {
      isOpen = true;
      document.getElementById('na-chat-panel').classList.add('na-open');
      document.getElementById('na-chat-badge').style.display = 'none';
      if (!document.getElementById('na-msgs').children.length) goNode('root');
    }

    function close() {
      isOpen = false;
      document.getElementById('na-chat-panel').classList.remove('na-open');
    }

    function toggle() { isOpen ? close() : open(); }

    /* ── Public API ─────────────────────────────────────────── */
    function openWithContext({ step, product } = {}) {
      context = { step, product };
      const ctxBar = document.getElementById('na-ctx-bar');
      const ctxTxt = document.getElementById('na-ctx-text');
      if (step === 'checkout' || product) {
        ctxTxt.textContent = product
          ? `محصول: ${product.name || product.title || ''}`
          : 'راهنمای ثبت سفارش';
        ctxBar.classList.add('na-visible');
      }
      open();
      // اگه checkout است، مستقیم به order_flow برو
      if (step === 'checkout' && document.getElementById('na-msgs').children.length === 0) {
        goNode('order_flow');
      }
    }

    return { init: injectDOM, open, close, toggle, openWithContext };
  })();


  /* ════════════════════════════════════════════════════════════
     3. CONTENT AGENT (admin only — بدون API key)
        از allorigins.win برای bypass CORS استفاده می‌کند
        محتوا توسط Claude API (از مرورگر) پردازش میشه
     ════════════════════════════════════════════════════════════ */
  const ContentAgent = (() => {

    let articles = [];
    let selected = new Set();
    let phase = 'idle'; // idle | scanning | processing
    let logEl = null;

    /* ── Helpers ──────────────────────────────────────────── */
    const delay = ms => new Promise(r => setTimeout(r, ms));

    async function proxyFetch(url) {
      const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error('Proxy fetch failed');
      return (await res.json()).contents;
    }

    function extractLinks(html, base) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const seen = new Set();
      const out  = [];
      doc.querySelectorAll('a[href]').forEach(a => {
        const title = a.textContent.trim();
        if (title.length < 15) return;
        try {
          const url = new URL(a.getAttribute('href'), base).href;
          if (!seen.has(url) && url.startsWith('http')) {
            seen.add(url);
            out.push({ url, title: title.slice(0,100) });
          }
        } catch {}
      });
      return out.slice(0, 14);
    }

    function extractContent(html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      ['script','style','nav','header','footer','aside'].forEach(
        s => doc.querySelectorAll(s).forEach(e => e.remove())
      );
      const title = doc.querySelector('h1')?.textContent?.trim()
        || doc.querySelector('title')?.textContent?.trim() || '';
      const content = (
        doc.querySelector('article')?.innerText ||
        doc.querySelector('main')?.innerText ||
        doc.querySelector('.content,.post-content,.entry-content')?.innerText ||
        doc.body?.innerText || ''
      ).trim().slice(0, 3500);
      return { title, content };
    }

    /* ── Claude API (مرورگر مستقیم — نیاز به API key دارد) ── */
    /* اما اگه Claude API در دسترس نبود، از fallback استفاده میشه */
    async function processWithClaude(title, content, mode, lang) {
      const modePrompts = {
        translate: `Translate this article to ${lang}. Keep the structure. Output JSON only: {"title":"...","content":"...","excerpt":"one sentence"}`,
        rewrite:   `Rewrite this article for a Persian graphic design & print marketplace blog. Make it engaging. Output JSON only: {"title":"...","content":"...","excerpt":"one sentence"}`,
        summarize: `Summarize this article for a Persian design/print audience and add your insights. Output JSON only: {"title":"...","content":"...","excerpt":"one sentence"}`,
      };

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1000,
            system: 'You are a content editor for Nash Graphic, a Persian design/print marketplace. ' +
                    modePrompts[mode] + ' Return ONLY valid JSON, no markdown.',
            messages: [{ role: 'user', content: `Title: ${title}\n\nContent:\n${content}` }]
          })
        });
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        const text = data.content?.[0]?.text || '{}';
        return JSON.parse(text.replace(/```json|```/g,'').trim());
      } catch {
        // Fallback: ذخیره محتوای خام
        return {
          title:   `[${mode.toUpperCase()}] ${title}`,
          content: content,
          excerpt: title.slice(0, 120),
        };
      }
    }

    /* ── Save to Supabase blog table ──────────────────────── */
    async function saveToBlog(post, sourceUrl) {
      const payload = {
        title:      post.title || 'بدون عنوان',
        content:    post.content || '',
        excerpt:    post.excerpt || '',
        author_id:  State.user?.id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('blog').insert(payload);
      if (error) throw error;
    }

    /* ── Log helpers ──────────────────────────────────────── */
    function log(msg, type = '') {
      if (!logEl) return;
      const div = document.createElement('div');
      div.className = `na-log-line ${type === 'ok' ? 'na-log-ok' : type === 'err' ? 'na-log-err' : type === 'warn' ? 'na-log-warn' : ''}`;
      div.textContent = `${new Date().toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} ${msg}`;
      logEl.appendChild(div);
      logEl.scrollTop = logEl.scrollHeight;
    }

    /* ── DOM ──────────────────────────────────────────────── */
    function injectDOM() {
      document.body.insertAdjacentHTML('beforeend', `
        <button id="na-content-btn" title="Content Agent">📥</button>
        <div id="na-content-panel" dir="rtl">
          <div class="na-ca-head">
            <span style="font-size:18px">📥</span>
            <span class="na-ca-title">Content Agent</span>
            <button class="na-close-btn" id="na-ca-close">✕</button>
          </div>
          <div class="na-ca-body" id="na-ca-body">
            <label class="na-field-label">URL سایت منبع</label>
            <input class="na-field" id="na-ca-url" type="url" placeholder="https://creativebloq.com/graphic-design" />

            <label class="na-field-label">نوع پردازش</label>
            <select class="na-field" id="na-ca-mode">
              <option value="translate">🌐 ترجمه به فارسی</option>
              <option value="rewrite">✍️ بازنویسی برای Nash</option>
              <option value="summarize">📝 خلاصه + بهبود</option>
            </select>

            <button class="na-btn na-btn-blue" id="na-ca-scan">🔍 اسکن سایت</button>

            <div id="na-ca-articles" style="display:none;margin-top:12px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span style="font-size:11px;color:#888" id="na-ca-count"></span>
                <button style="font-size:10px;color:#6e8ec8;background:none;border:none;cursor:pointer" id="na-ca-toggle-all">انتخاب همه</button>
              </div>
              <div class="na-article-list" id="na-ca-list"></div>
              <div class="na-progress-bar" id="na-ca-prog-wrap" style="display:none">
                <div class="na-progress-fill" id="na-ca-prog"></div>
              </div>
              <button class="na-btn na-btn-green" id="na-ca-process">✨ پردازش و ذخیره در بلاگ</button>
            </div>

            <div class="na-log" id="na-ca-log" style="display:none"></div>
          </div>
        </div>
      `);

      logEl = document.getElementById('na-ca-log');

      // show/hide button based on role
      function syncBtn() {
        const btn = document.getElementById('na-content-btn');
        if (!btn) return;
        const isAdmin = State.user?.role === 'admin';
        btn.style.display = isAdmin ? 'flex' : 'none';
      }
      syncBtn();
      // re-sync هر بار که State تغییر کند
      const origUpdateHeader = typeof App !== 'undefined' ? App.updateHeader : null;
      if (origUpdateHeader) {
        App.updateHeader = function() { origUpdateHeader.call(App); syncBtn(); };
      }

      document.getElementById('na-content-btn').onclick = togglePanel;
      document.getElementById('na-ca-close').onclick = closePanel;
      document.getElementById('na-ca-scan').onclick = runScan;
      document.getElementById('na-ca-process').onclick = runProcess;
      document.getElementById('na-ca-toggle-all').onclick = toggleAll;
    }

    function togglePanel() {
      const p = document.getElementById('na-content-panel');
      p.classList.toggle('na-open');
    }
    function closePanel() {
      document.getElementById('na-content-panel').classList.remove('na-open');
    }

    function renderArticles() {
      const list  = document.getElementById('na-ca-list');
      const count = document.getElementById('na-ca-count');
      const wrap  = document.getElementById('na-ca-articles');
      if (!articles.length) { wrap.style.display = 'none'; return; }
      wrap.style.display = 'block';
      count.textContent = `${articles.length} مقاله یافت شد`;
      list.innerHTML = '';
      articles.forEach((a, i) => {
        const div = document.createElement('div');
        div.className = 'na-article-item' + (selected.has(i) ? ' selected' : '');
        div.innerHTML = `<div class="na-article-cb">${selected.has(i) ? '✓' : ''}</div><span>${a.title.slice(0,75)}</span>`;
        div.onclick = () => {
          selected.has(i) ? selected.delete(i) : selected.add(i);
          renderArticles();
        };
        list.appendChild(div);
      });
    }

    function toggleAll() {
      if (selected.size === articles.length) selected.clear();
      else articles.forEach((_, i) => selected.add(i));
      renderArticles();
    }

    function setProgress(done, total) {
      const bar  = document.getElementById('na-ca-prog');
      const wrap = document.getElementById('na-ca-prog-wrap');
      wrap.style.display = total ? 'block' : 'none';
      bar.style.width = total ? `${Math.round(done/total*100)}%` : '0%';
    }

    async function runScan() {
      const url = document.getElementById('na-ca-url').value.trim();
      if (!url) return;
      phase = 'scanning';
      document.getElementById('na-ca-log').style.display = 'block';
      document.getElementById('na-ca-scan').disabled = true;
      log('در حال اسکن ' + url + ' ...');
      try {
        const html = await proxyFetch(url);
        articles = extractLinks(html, url);
        selected = new Set(articles.map((_,i) => i));
        renderArticles();
        log(`${articles.length} مقاله پیدا شد ✓`, 'ok');
      } catch (e) {
        log('خطا: ' + e.message, 'err');
      }
      document.getElementById('na-ca-scan').disabled = false;
      phase = 'idle';
    }

    async function runProcess() {
      if (!selected.size) return;
      const mode = document.getElementById('na-ca-mode').value;
      const toProcess = articles.filter((_,i) => selected.has(i));
      phase = 'processing';
      document.getElementById('na-ca-process').disabled = true;
      setProgress(0, toProcess.length);
      log(`شروع پردازش ${toProcess.length} مقاله...`);

      let done = 0;
      for (const article of toProcess) {
        try {
          log(`دریافت: ${article.title.slice(0,50)}...`);
          const html = await proxyFetch(article.url);
          const { title, content } = extractContent(html);
          if (!content || content.length < 80) {
            log('محتوا ناکافی، رد شد', 'warn'); done++; setProgress(done, toProcess.length); continue;
          }
          log(`پردازش با AI: ${(title||article.title).slice(0,45)}...`);
          const processed = await processWithClaude(title || article.title, content, mode, 'Persian (Farsi)');
          await saveToBlog(processed, article.url);
          done++; setProgress(done, toProcess.length);
          log(`ذخیره شد: ${processed.title?.slice(0,50)}`, 'ok');
          await delay(1200);
        } catch(e) {
          done++; setProgress(done, toProcess.length);
          log(`خطا: ${e.message}`, 'err');
        }
      }
      log(`✅ تمام! ${done}/${toProcess.length} مقاله ذخیره شد.`, 'ok');
      document.getElementById('na-ca-process').disabled = false;
      phase = 'idle';
      // refresh blog if currently on blog page
      if (typeof Router !== 'undefined' && Router.current === 'blog') App.loadBlog?.();
    }

    return { init: injectDOM };
  })();

  const delay = ms => new Promise(r => setTimeout(r, ms));

  /* ════════════════════════════════════════════════════════════
     4. HOOK INTO CART CHECKOUT
        cart.js → Cart.checkout() باز شدن چت رو trigger می‌کند
     ════════════════════════════════════════════════════════════ */
  function hookCartCheckout() {
    if (typeof Cart === 'undefined') return;
    const orig = Cart.checkout.bind(Cart);
    Cart.checkout = function() {
      orig();
      // چند ثانیه بعد از باز شدن modal سفارش، چت رو نشون بده
      setTimeout(() => {
        if (window.NashSupport) {
          window.NashSupport.openWithContext({ step: 'checkout' });
        }
      }, 800);
    };
  }

  /* ════════════════════════════════════════════════════════════
     5. BOOTSTRAP
     ════════════════════════════════════════════════════════════ */
  function boot() {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    // Init Support Chat
    SupportAgent.init();
    window.NashSupport = SupportAgent;

    // Init Content Agent
    ContentAgent.init();

    // Hook cart checkout
    hookCartCheckout();

    // اگه App هنوز لود نشده، hook بعد از init انجام میشه
    const origInit = typeof App !== 'undefined' ? App.init?.bind(App) : null;
    if (origInit) {
      App.init = async function() {
        await origInit();
        hookCartCheckout(); // دوباره برای اطمینان
      };
    }

    console.log('✅ nash-agents.js loaded');
  }

  whenReady(boot);

})();
