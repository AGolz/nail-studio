(() => {
  const data = window.NARA_DATA;
  const locale = document.documentElement.lang in data.copy ? document.documentElement.lang : 'hy';
  const copy = data.copy[locale];
  const bookingCopy = copy.booking;
  const localeTag = locale === 'hy' ? 'hy-AM' : locale === 'ru' ? 'ru-AM' : 'en-US';

  const readPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const formatMoney = (amount, isFrom = false) => `${isFrom ? `${bookingCopy.from} ` : ''}${new Intl.NumberFormat(localeTag, { maximumFractionDigits: 0 }).format(amount)} AMD`;
  const formatDate = (date) => {
    const [year, month, day] = date.split('-').map(Number);
    const monthName = copy.months[month - 1];
    if (locale === 'en') return `${monthName} ${day}, ${year}`;
    if (locale === 'hy') return `${day} ${monthName} ${year} թ.`;
    return `${day} ${monthName} ${year} г.`;
  };

  document.querySelectorAll('[data-copy]').forEach((element) => {
    const value = readPath(copy, element.dataset.copy);
    if (value !== undefined) element.textContent = value;
  });
  document.querySelectorAll('[data-copy-html]').forEach((element) => {
    const value = readPath(copy, element.dataset.copyHtml);
    if (value !== undefined) element.innerHTML = value;
  });
  document.querySelector('[data-nav-label]')?.setAttribute('aria-label', copy.navLabel);
  document.querySelector('[data-filter-label]')?.setAttribute('aria-label', copy.filterLabel);
  document.querySelector('[data-language-label]')?.setAttribute('aria-label', copy.languageLabel);
  const menuButton = document.querySelector('[data-menu-toggle]');
  if (menuButton) menuButton.setAttribute('aria-label', copy.menu);

  const serviceList = document.querySelector('#serviceList');
  serviceList.innerHTML = ['manicure', 'pedicure', 'brows'].map((category) => {
    const services = data.services.filter((service) => service.category === category);
    return `
      <section class="service-group" aria-label="${escapeHtml(copy.serviceCategories[category])}">
        <h3 class="service-group-title">${escapeHtml(copy.serviceCategories[category])}</h3>
        ${services.map((service) => `
          <article class="service-row">
            <div class="service-main">
              <h4 class="service-name">${escapeHtml(service.name[locale])}</h4>
              <p class="service-description">${escapeHtml(service.description[locale])}</p>
            </div>
            <span class="service-meta">${service.minutes} ${escapeHtml(copy.serviceTime)}</span>
            <span class="service-price">${formatMoney(service.price, service.priceFrom)}</span>
            <a class="service-book" href="#booking" data-book-service="${service.id}" aria-label="${escapeHtml(copy.book)}: ${escapeHtml(service.name[locale])}">${escapeHtml(copy.book)} ↗</a>
          </article>
        `).join('')}
      </section>
    `;
  }).join('');

  const artistGrid = document.querySelector('#artistGrid');
  artistGrid.innerHTML = data.staff.map((artist) => `
    <article class="artist-card">
      <div class="artist-photo-wrap"><img class="artist-photo" src="${artist.image}" alt="${escapeHtml(artist.name[locale])} · ${escapeHtml(artist.role[locale])}" loading="lazy"></div>
      <div class="artist-info">
        <div><h3 class="artist-name">${escapeHtml(artist.name[locale])}</h3><p class="artist-role">${escapeHtml(artist.role[locale])}</p><small class="artist-demo">${escapeHtml(copy.teamNote)}</small></div>
        <p class="artist-bio">${escapeHtml(artist.bio[locale])}</p>
      </div>
    </article>
  `).join('');

  const galleryGrid = document.querySelector('#galleryGrid');
  galleryGrid.innerHTML = data.gallery.map((item) => `
    <figure class="gallery-item" data-category="${item.category}">
      <div class="gallery-image-wrap"><img class="gallery-image" src="${item.image}" alt="${escapeHtml(item.alt[locale])}" loading="lazy"></div>
      <figcaption class="gallery-caption"><strong>${escapeHtml(item.title[locale])}</strong><span>${escapeHtml(copy[`filter${item.category === 'manicure' ? 'Mani' : item.category === 'pedicure' ? 'Pedi' : 'Brows'}`])}</span></figcaption>
    </figure>
  `).join('');

  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((filterButton) => {
        const active = filterButton === button;
        filterButton.classList.toggle('is-active', active);
        filterButton.setAttribute('aria-pressed', String(active));
      });
      document.querySelectorAll('.gallery-item').forEach((item) => {
        item.hidden = filter !== 'all' && item.dataset.category !== filter;
      });
    });
  });

  const faqList = document.querySelector('#faqList');
  faqList.innerHTML = copy.faq.map(([question, answer]) => `
    <details class="faq-item"><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>
  `).join('');

  const header = document.querySelector('.site-header');
  menuButton?.addEventListener('click', () => {
    const isOpen = header.classList.toggle('is-menu-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });
  document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', () => {
    header.classList.remove('is-menu-open');
    menuButton?.setAttribute('aria-expanded', 'false');
  }));

  const wizard = document.querySelector('#bookingWizard');
  const state = {
    step: 0,
    serviceId: '',
    addonIds: [],
    masterId: '',
    assignedMasterId: '',
    date: '',
    time: '',
    name: '',
    phone: ''
  };

  const getService = () => data.services.find((service) => service.id === state.serviceId);
  const getAddons = () => data.addons.filter((addon) => state.addonIds.includes(addon.id));
  const getCompatibleMasters = () => {
    const service = getService();
    return service ? data.staff.filter((artist) => artist.categories.includes(service.category)) : [];
  };
  const getMaster = (id) => data.staff.find((artist) => artist.id === id);
  const getTotals = () => {
    const service = getService();
    if (!service) return { price: 0, minutes: 0, from: false };
    const addons = getAddons();
    return {
      price: service.price + addons.reduce((total, addon) => total + (addon.price || addon.priceFrom || 0), 0),
      minutes: service.minutes + addons.reduce((total, addon) => total + addon.minutes, 0),
      from: Boolean(service.priceFrom || addons.some((addon) => addon.priceFrom))
    };
  };
  const timeToMinutes = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const minutesToTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const isoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dateLimit = (offsetDays) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offsetDays);
    return isoDate(date);
  };
  const isDateAllowed = (dateValue) => {
    const date = new Date(`${dateValue}T12:00:00`);
    return dateValue >= dateLimit(0) && dateValue <= dateLimit(21) && !Number.isNaN(date.valueOf());
  };
  const overlaps = (start, duration, busyStart, busyDuration) => start < busyStart + busyDuration && start + duration > busyStart;

  function availableStaffAt(time) {
    if (!state.date) return [];
    const service = getService();
    if (!service) return [];
    const weekday = new Date(`${state.date}T12:00:00`).getDay();
    const dateNumber = Number(state.date.slice(-2));
    const start = timeToMinutes(time);
    const duration = getTotals().minutes;
    return getCompatibleMasters().filter((artist, artistIndex) => {
      if (!artist.days.includes(weekday)) return false;
      const shiftStart = timeToMinutes(artist.start);
      const shiftEnd = timeToMinutes(artist.end);
      if (start < shiftStart || start + duration > shiftEnd) return false;
      const busyOffset = (dateNumber + artistIndex) % 3;
      const busyBlocks = [
        { start: 11 * 60 + busyOffset * 30, duration: 60 },
        { start: 14 * 60 + ((dateNumber + artistIndex * 2) % 3) * 30, duration: 60 },
        { start: 16 * 60 + ((dateNumber + artistIndex) % 2) * 30, duration: 30 }
      ];
      return !busyBlocks.some((block) => overlaps(start, duration, block.start, block.duration));
    });
  }

  function availableSlots() {
    if (!isDateAllowed(state.date)) return [];
    const slots = [];
    for (let start = 10 * 60; start <= 18 * 60; start += 30) {
      const time = minutesToTime(start);
      const candidates = availableStaffAt(time);
      const selected = state.masterId === 'any' ? candidates[0] : candidates.find((artist) => artist.id === state.masterId);
      if (selected) slots.push({ time, artist: selected });
    }
    return slots;
  }

  function progressMarkup() {
    return `<ol class="wizard-progress">${bookingCopy.steps.map((label, index) => `<li class="${index === state.step ? 'is-current' : index < state.step ? 'is-done' : ''}" ${index === state.step ? 'aria-current="step"' : ''}>${escapeHtml(label)}</li>`).join('')}</ol>`;
  }

  function actionMarkup({ back = true, next = true, disabled = false, submit = false, confirm = false } = {}) {
    const action = confirm ? 'confirm' : 'next';
    return `<div class="wizard-actions">${back ? `<button class="button button-outline" type="button" data-action="back">${escapeHtml(bookingCopy.back)}</button>` : '<span></span>'}${next ? `<button class="button button-dark" type="${submit ? 'submit' : 'button'}" ${submit ? '' : `data-action="${action}"`} ${disabled ? 'disabled' : ''}>${escapeHtml(confirm ? bookingCopy.confirm : bookingCopy.next)}</button>` : ''}</div>`;
  }

  function renderServiceStep() {
    const service = getService();
    const compatibleAddons = service ? data.addons.filter((addon) => addon.services.includes(service.id)) : [];
    const totals = getTotals();
    return `
      <h3 class="wizard-stage-title">${escapeHtml(bookingCopy.chooseService)}</h3>
      <p class="wizard-hint">${escapeHtml(copy.servicesText)}</p>
      <fieldset class="service-choice-list" aria-label="${escapeHtml(bookingCopy.chooseService)}">
        ${data.services.map((item) => `
          <label class="service-choice">
            <input type="radio" name="service" value="${item.id}" ${item.id === state.serviceId ? 'checked' : ''}>
            <span><strong class="choice-name">${escapeHtml(item.name[locale])}</strong><small class="choice-description">${escapeHtml(item.description[locale])}</small><span class="choice-meta"><span>${item.minutes} ${escapeHtml(copy.serviceTime)}</span><strong>${formatMoney(item.price)}</strong></span></span>
          </label>
        `).join('')}
      </fieldset>
      ${service ? `
        <h4 class="wizard-subhead">${escapeHtml(bookingCopy.addons)}</h4>
        ${compatibleAddons.length ? `<div class="addon-list">${compatibleAddons.map((addon) => `
          <label class="addon-choice">
            <input type="checkbox" name="addon" value="${addon.id}" ${state.addonIds.includes(addon.id) ? 'checked' : ''}>
            <span><strong class="addon-name">${escapeHtml(addon.name[locale])}</strong><small class="addon-description">${escapeHtml(addon.description[locale])}</small><span class="addon-meta"><span>+${addon.minutes} ${escapeHtml(copy.serviceTime)}</span><strong>${formatMoney(addon.price || addon.priceFrom, Boolean(addon.priceFrom))}</strong></span></span>
          </label>
        `).join('')}</div>` : `<p class="inline-message">${escapeHtml(bookingCopy.noAddons)}</p>`}
        <div class="estimate-row"><span>${escapeHtml(bookingCopy.duration)}</span><strong>${totals.minutes} ${escapeHtml(copy.serviceTime)}</strong></div>
        <div class="estimate-row"><span>${escapeHtml(bookingCopy.totalPrice)}</span><strong>${formatMoney(totals.price, totals.from)}</strong></div>
      ` : ''}
      ${actionMarkup({ back: false, disabled: !service })}
    `;
  }

  function renderMasterStep() {
    const compatible = getCompatibleMasters();
    return `
      <h3 class="wizard-stage-title">${escapeHtml(bookingCopy.chooseMaster)}</h3>
      <p class="wizard-hint">${escapeHtml(getService().name[locale])}</p>
      <fieldset class="master-choice-list" aria-label="${escapeHtml(bookingCopy.chooseMaster)}">
        <label class="master-choice"><input type="radio" name="master" value="any" ${state.masterId === 'any' ? 'checked' : ''}><span><strong class="master-choice-name">${escapeHtml(bookingCopy.anyMaster)}</strong></span></label>
        ${compatible.map((artist) => `<label class="master-choice"><input type="radio" name="master" value="${artist.id}" ${state.masterId === artist.id ? 'checked' : ''}><span><strong class="master-choice-name">${escapeHtml(artist.name[locale])}</strong><small class="master-choice-role">${escapeHtml(artist.role[locale])}</small></span></label>`).join('')}
      </fieldset>
      ${actionMarkup({ disabled: !state.masterId })}
    `;
  }

  function renderDateStep() {
    const slots = availableSlots();
    const chosenSlot = slots.find((slot) => slot.time === state.time);
    return `
      <h3 class="wizard-stage-title">${escapeHtml(bookingCopy.chooseDate)}</h3>
      <p class="wizard-hint">${escapeHtml(bookingCopy.scheduleNote)}</p>
      <div class="date-time-grid">
        <div><label class="field-label" for="bookingDate">${escapeHtml(bookingCopy.date)}</label><input class="form-control" id="bookingDate" type="date" name="date" min="${dateLimit(0)}" max="${dateLimit(21)}" value="${escapeHtml(state.date)}"></div>
        <div><span class="field-label">${escapeHtml(bookingCopy.chooseTime)}</span>${state.date ? slots.length ? `<div class="slots" role="group" aria-label="${escapeHtml(bookingCopy.chooseTime)}">${slots.map((slot) => `<button class="slot-button ${state.time === slot.time ? 'is-selected' : ''}" type="button" data-time="${slot.time}" data-staff="${slot.artist.id}" aria-pressed="${state.time === slot.time}">${slot.time}</button>`).join('')}</div>` : `<p class="slot-empty">${escapeHtml(bookingCopy.noSlots)}</p>` : `<p class="slot-empty">${escapeHtml(bookingCopy.selectDateFirst)}</p>`}</div>
      </div>
      ${chosenSlot ? `<div class="estimate-row"><span>${escapeHtml(bookingCopy.master)}</span><strong>${escapeHtml(chosenSlot.artist.name[locale])}</strong></div>` : ''}
      ${actionMarkup({ disabled: !state.date || !state.time })}
    `;
  }

  function renderContactStep() {
    return `
      <h3 class="wizard-stage-title">${escapeHtml(bookingCopy.name)} &amp; ${escapeHtml(bookingCopy.phone)}</h3>
      <p class="wizard-hint">${escapeHtml(bookingCopy.demo)}</p>
      <form id="guestDetails" novalidate>
        <div class="contact-form-grid">
          <div><label class="field-label" for="guestName">${escapeHtml(bookingCopy.name)}</label><input class="form-control" id="guestName" name="name" type="text" autocomplete="name" minlength="2" required value="${escapeHtml(state.name)}" placeholder="${escapeHtml(bookingCopy.namePlaceholder)}"><p class="field-error" data-error="name"></p></div>
          <div><label class="field-label" for="guestPhone">${escapeHtml(bookingCopy.phone)}</label><input class="form-control" id="guestPhone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required value="${escapeHtml(state.phone)}" placeholder="${escapeHtml(bookingCopy.phonePlaceholder)}"><p class="field-error" data-error="phone"></p></div>
        </div>
        ${actionMarkup({ submit: true, disabled: false })}
      </form>
    `;
  }

  function renderReviewStep() {
    const service = getService();
    const master = getMaster(state.assignedMasterId || state.masterId);
    const addons = getAddons();
    const totals = getTotals();
    const rows = [
      [bookingCopy.service, service.name[locale]],
      [bookingCopy.extras, addons.length ? addons.map((addon) => addon.name[locale]).join(', ') : '—'],
      [bookingCopy.master, master ? master.name[locale] : '—'],
      [bookingCopy.date, formatDate(state.date)],
      [bookingCopy.time, state.time],
      [bookingCopy.totalDuration, `${totals.minutes} ${copy.serviceTime}`],
      [bookingCopy.totalPrice, formatMoney(totals.price, totals.from)]
    ];
    return `<h3 class="wizard-stage-title">${escapeHtml(bookingCopy.reviewTitle)}</h3><p class="wizard-hint">${escapeHtml(state.name)} · ${escapeHtml(state.phone)}</p><dl class="review-list">${rows.map(([label, value], index) => `<div class="review-row"><dt>${escapeHtml(label)}</dt><dd class="${index === rows.length - 1 ? 'review-total' : ''}">${escapeHtml(value)}</dd></div>`).join('')}</dl>${actionMarkup({ confirm: true })}`;
  }

  function renderCompleteStep() {
    return `<div class="booking-complete"><div class="complete-mark" aria-hidden="true">✓</div><h3>${escapeHtml(bookingCopy.completedTitle)}</h3><p>${escapeHtml(bookingCopy.completedText)}</p><button class="button button-dark" type="button" data-action="restart">${escapeHtml(bookingCopy.startOver)}</button></div>`;
  }

  function renderWizard() {
    wizard.setAttribute('aria-live', 'polite');
    if (state.step === 5) {
      wizard.innerHTML = renderCompleteStep();
      return;
    }
    const stage = state.step === 0 ? renderServiceStep() : state.step === 1 ? renderMasterStep() : state.step === 2 ? renderDateStep() : state.step === 3 ? renderContactStep() : renderReviewStep();
    wizard.innerHTML = `${progressMarkup()}<div class="wizard-stage">${stage}</div>`;
    const form = wizard.querySelector('#guestDetails');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const nameInput = form.elements.name;
      const phoneInput = form.elements.phone;
      const digits = phoneInput.value.replace(/\D/g, '');
      const phoneIsValid = /^\+?[\d\s().-]{8,24}$/.test(phoneInput.value.trim())
        && digits.length >= 8
        && digits.length <= 15;
      state.name = nameInput.value.trim();
      state.phone = phoneInput.value.trim();
      form.querySelector('[data-error="name"]').textContent = state.name.length < 2 ? bookingCopy.name : '';
      form.querySelector('[data-error="phone"]').textContent = phoneIsValid ? '' : bookingCopy.phoneError;
      if (state.name.length < 2) { nameInput.focus(); return; }
      if (!phoneIsValid) { phoneInput.focus(); return; }
      state.step = 4;
      renderWizard();
    });
  }

  wizard.addEventListener('change', (event) => {
    const target = event.target;
    if (target.name === 'service') {
      state.serviceId = target.value;
      state.addonIds = [];
      state.masterId = '';
      state.assignedMasterId = '';
      state.date = '';
      state.time = '';
      renderWizard();
    } else if (target.name === 'addon') {
      state.addonIds = [...wizard.querySelectorAll('input[name="addon"]:checked')].map((input) => input.value);
      state.date = '';
      state.time = '';
      state.assignedMasterId = '';
      renderWizard();
    } else if (target.name === 'master') {
      state.masterId = target.value;
      state.date = '';
      state.time = '';
      state.assignedMasterId = '';
      renderWizard();
    } else if (target.name === 'date') {
      state.date = isDateAllowed(target.value) ? target.value : '';
      state.time = '';
      state.assignedMasterId = '';
      renderWizard();
    }
  });

  wizard.addEventListener('click', (event) => {
    const timeButton = event.target.closest('[data-time]');
    if (timeButton) {
      state.time = timeButton.dataset.time;
      state.assignedMasterId = timeButton.dataset.staff;
      renderWizard();
      return;
    }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'back') {
      state.step = Math.max(0, state.step - 1);
      renderWizard();
    } else if (action === 'next') {
      if (state.step === 0 && !state.serviceId) return;
      if (state.step === 1 && !state.masterId) return;
      if (state.step === 2 && (!state.date || !state.time)) return;
      state.step = Math.min(4, state.step + 1);
      renderWizard();
    } else if (action === 'confirm') {
      state.step = 5;
      renderWizard();
    } else if (action === 'restart') {
      Object.assign(state, { step: 0, serviceId: '', addonIds: [], masterId: '', assignedMasterId: '', date: '', time: '', name: '', phone: '' });
      renderWizard();
    }
  });

  serviceList.addEventListener('click', (event) => {
    const link = event.target.closest('[data-book-service]');
    if (!link || !data.services.some((service) => service.id === link.dataset.bookService)) return;
    event.preventDefault();
    Object.assign(state, { step: 0, serviceId: link.dataset.bookService, addonIds: [], masterId: '', assignedMasterId: '', date: '', time: '' });
    renderWizard();
    document.querySelector('#booking').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    const heading = wizard.querySelector('.wizard-stage-title');
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  });

  const mobileBook = document.querySelector('.mobile-book');
  const bookingSection = document.querySelector('#booking');
  if (mobileBook && bookingSection && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      mobileBook.hidden = entry.isIntersecting;
    }).observe(bookingSection);
  }

  renderWizard();
})();