document.documentElement.classList.remove('no-js');

var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initRevealAnimations(scope) {
  var root = scope instanceof Element ? scope : document;
  var revealElements = root.querySelectorAll('[data-reveal], .reveal-fade-up');
  if (!revealElements.length) {
    return;
  }

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealElements.forEach(function (element) {
      element.classList.add('motion-inview');
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries, io) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add('motion-inview');
        io.unobserve(entry.target);
      });
    },
    {
      root: null,
      threshold: 0.15,
      rootMargin: '0px 0px -8% 0px'
    }
  );

  revealElements.forEach(function (element) {
    if (element.classList.contains('motion-inview')) {
      return;
    }
    observer.observe(element);
  });
}

function parseJsonScript(element, fallback) {
  if (!element) return fallback;
  try {
    return JSON.parse(element.textContent || '');
  } catch (error) {
    return fallback;
  }
}

function formatThemeMoney(cents, moneyFormat) {
  if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
    return window.Shopify.formatMoney(cents, moneyFormat);
  }
  return (Number(cents || 0) / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function initProductSection(sectionRoot) {
  if (!(sectionRoot instanceof Element)) {
    return;
  }
  if (sectionRoot.getAttribute('data-variant-init') === 'true') {
    return;
  }
  sectionRoot.setAttribute('data-variant-init', 'true');

  var thumbs = sectionRoot.querySelectorAll('[data-media-thumb]');
  var featuredItems = sectionRoot.querySelectorAll('.collector-product__featured-item');

  function activateMedia(mediaId) {
    if (!mediaId || !featuredItems.length || !thumbs.length) {
      return;
    }

    featuredItems.forEach(function (item) {
      item.classList.toggle('is-active', item.getAttribute('data-media-id') === String(mediaId));
    });

    thumbs.forEach(function (thumb) {
      var isActive = thumb.getAttribute('data-target-media-id') === String(mediaId);
      thumb.classList.toggle('is-active', isActive);
      thumb.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  if (thumbs.length && featuredItems.length) {
    thumbs.forEach(function (thumb) {
      thumb.setAttribute('aria-pressed', thumb.classList.contains('is-active') ? 'true' : 'false');
      thumb.addEventListener('click', function () {
        activateMedia(thumb.getAttribute('data-target-media-id'));
      });
    });
  }

  var productForm = sectionRoot.querySelector('form[action*="/cart/add"]');
  if (!productForm) {
    return;
  }

  var optionInputs = Array.from(productForm.querySelectorAll('[data-variant-picker] select[name^="options["]'));
  var variantIdInput = productForm.querySelector('input[name="id"][data-variant-id-input]');
  var addButton = productForm.querySelector('button[name="add"], [data-add-to-cart]');
  var priceContainer = sectionRoot.querySelector('[data-price-root], .price');
  var saleBadge = sectionRoot.querySelector('[data-sale-badge]');
  var quantityInput = productForm.querySelector('input[name="quantity"]');
  var quantityIncrease = productForm.querySelector('[data-quantity-increase]');
  var quantityDecrease = productForm.querySelector('[data-quantity-decrease]');
  var sectionHost = sectionRoot.closest('[id^="shopify-section-"]') || sectionRoot.parentElement || sectionRoot;
  var variants = parseJsonScript(sectionHost.querySelector('[data-product-variants]'), []);
  var moneyFormat = parseJsonScript(sectionHost.querySelector('[data-product-money-format]'), '${{amount}}') || '${{amount}}';
  var supportsVariantUrl = window.location.search.indexOf('variant=') !== -1;
  var productId = parseInt(sectionRoot.getAttribute('data-product-id') || '0', 10);

  if (!variantIdInput || !Array.isArray(variants) || !variants.length) {
    return;
  }

  var variantPickerRoot = productForm.querySelector('[data-variant-picker]');
  var premiumOptionGroups = [];

  function findSelectedVariant() {
    if (!optionInputs.length) {
      return variants.find(function (variant) {
        return String(variant.id) === String(variantIdInput.value);
      }) || variants[0] || null;
    }

    var selectedOptions = optionInputs.map(function (input) {
      return input.value;
    });

    return (
      variants.find(function (variant) {
        if (!variant || !Array.isArray(variant.options)) {
          return false;
        }
        return selectedOptions.every(function (value, index) {
          return variant.options[index] === value;
        });
      }) || null
    );
  }

  function getSelectedOptionsWithOverride(position, value) {
    return optionInputs.map(function (input, index) {
      return index === position - 1 ? value : input.value;
    });
  }

  function optionValueHasVariant(position, value) {
    var selectedOptions = getSelectedOptionsWithOverride(position, value);
    return variants.some(function (variant) {
      if (!variant || !Array.isArray(variant.options)) {
        return false;
      }
      return selectedOptions.every(function (selectedValue, index) {
        return variant.options[index] === selectedValue;
      });
    });
  }

  function updatePremiumOptionCards() {
    if (!premiumOptionGroups.length) {
      return;
    }

    premiumOptionGroups.forEach(function (group) {
      var selectedValue = group.select.value;
      var focusableCard = null;

      group.cards.forEach(function (card) {
        var value = card.getAttribute('data-option-value') || '';
        var isSelected = value === selectedValue;
        var hasVariant = optionValueHasVariant(group.position, value);
        var isDisabled = !hasVariant && !isSelected;
        var stateText = card.querySelector('[data-option-state]');

        card.classList.toggle('is-selected', isSelected);
        card.classList.toggle('is-disabled', !hasVariant);
        card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
        card.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
        card.disabled = isDisabled;

        if (stateText) {
          stateText.textContent = isSelected ? 'Selected' : '';
        }

        if (isSelected || (!focusableCard && !isDisabled)) {
          focusableCard = card;
        }

        card.tabIndex = -1;
      });

      if (focusableCard) {
        focusableCard.tabIndex = 0;
      }
    });
  }

  function selectPremiumOption(group, card, shouldFocus) {
    if (!group || !card || card.disabled || card.getAttribute('aria-disabled') === 'true') {
      return;
    }

    var value = card.getAttribute('data-option-value') || '';
    if (!value || group.select.value === value) {
      updatePremiumOptionCards();
      if (shouldFocus) card.focus();
      return;
    }

    group.select.value = value;
    group.select.dispatchEvent(new Event('change', { bubbles: true }));
    if (shouldFocus) {
      card.focus();
    }
  }

  function movePremiumOptionFocus(group, currentCard, direction) {
    var enabledCards = group.cards.filter(function (card) {
      return !card.disabled && card.getAttribute('aria-disabled') !== 'true';
    });
    if (!enabledCards.length) {
      return;
    }

    var currentIndex = enabledCards.indexOf(currentCard);
    var nextIndex = currentIndex >= 0 ? currentIndex + direction : 0;

    if (nextIndex < 0) {
      nextIndex = enabledCards.length - 1;
    } else if (nextIndex >= enabledCards.length) {
      nextIndex = 0;
    }

    enabledCards[nextIndex].focus();
  }

  function initPremiumOptionCards() {
    if (!variantPickerRoot || variantPickerRoot.getAttribute('data-premium-options-enabled') !== 'true') {
      return;
    }

    var groups = Array.from(variantPickerRoot.querySelectorAll('[data-option-group]'));
    premiumOptionGroups = groups
      .map(function (groupElement) {
        var select = groupElement.querySelector('select[data-premium-option-source]');
        var cards = Array.from(groupElement.querySelectorAll('[data-premium-option-card]'));
        var position = parseInt(groupElement.getAttribute('data-option-position') || '0', 10);

        if (!select || !cards.length || !position) {
          return null;
        }

        return {
          element: groupElement,
          select: select,
          cards: cards,
          position: position
        };
      })
      .filter(Boolean);

    if (!premiumOptionGroups.length) {
      return;
    }

    premiumOptionGroups.forEach(function (group) {
      group.select.tabIndex = -1;

      group.cards.forEach(function (card) {
        card.addEventListener('click', function () {
          selectPremiumOption(group, card, true);
        });

        card.addEventListener('keydown', function (event) {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            selectPremiumOption(group, card, true);
            return;
          }

          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            movePremiumOptionFocus(group, card, 1);
            return;
          }

          if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            movePremiumOptionFocus(group, card, -1);
            return;
          }

          if (event.key === 'Home') {
            event.preventDefault();
            movePremiumOptionFocus(group, null, 1);
            return;
          }

          if (event.key === 'End') {
            event.preventDefault();
            movePremiumOptionFocus(group, null, -1);
          }
        });
      });
    });

    variantPickerRoot.classList.add('variant-picker--premium-ready');
    updatePremiumOptionCards();
  }

  function updatePriceMarkup(variant) {
    if (!priceContainer || !variant) {
      return;
    }

    var onSale = Number(variant.compare_at_price) > Number(variant.price);
    if (onSale) {
      priceContainer.innerHTML =
        '<span class="price__sale" data-price-current>' +
        formatThemeMoney(variant.price, moneyFormat) +
        '</span>' +
        '<s class="price__compare" data-price-compare>' +
        formatThemeMoney(variant.compare_at_price, moneyFormat) +
        '</s>';
      return;
    }

    priceContainer.innerHTML =
      '<span class="price__regular" data-price-current>' + formatThemeMoney(variant.price, moneyFormat) + '</span>';
  }

  function updateAvailability(variant) {
    if (!addButton) {
      return;
    }

    if (!variant) {
      addButton.disabled = true;
      if (saleBadge) saleBadge.classList.add('is-hidden');
      addButton.textContent = 'Add to cart';
      return;
    }

    addButton.disabled = false;
    addButton.textContent = 'Add to cart';

    if (saleBadge) {
      saleBadge.classList.toggle('is-hidden', !(Number(variant.compare_at_price) > Number(variant.price)));
    }
  }

  function updateUrl(variant) {
    if (!supportsVariantUrl || !variant || !window.history || typeof window.history.replaceState !== 'function') {
      return;
    }
    var url = new URL(window.location.href);
    url.searchParams.set('variant', String(variant.id));
    window.history.replaceState({}, '', url.toString());
  }

  function syncVariantState() {
    var variant = findSelectedVariant();

    variantIdInput.value = variant ? String(variant.id) : '';
    updatePriceMarkup(variant);
    updateAvailability(variant);
    updatePremiumOptionCards();

    if (variant && variant.featured_media && variant.featured_media.id) {
      activateMedia(variant.featured_media.id);
    }
    if (variant) {
      updateUrl(variant);
    }

    document.dispatchEvent(
      new CustomEvent('variant:change', {
        detail: {
          sectionId: sectionRoot.getAttribute('data-product-section') || '',
          productId: productId || null,
          variant: variant
        }
      })
    );
  }

  optionInputs.forEach(function (input) {
    input.addEventListener('change', syncVariantState);
  });

  initPremiumOptionCards();

  if (quantityInput) {
    quantityInput.addEventListener('change', function () {
      var min = parseInt(quantityInput.getAttribute('min') || '1', 10);
      var parsed = parseInt(quantityInput.value || String(min), 10);
      quantityInput.value = String(Math.max(min, isNaN(parsed) ? min : parsed));
    });
  }

  if (quantityIncrease && quantityInput) {
    quantityIncrease.addEventListener('click', function () {
      var min = parseInt(quantityInput.getAttribute('min') || '1', 10);
      var current = parseInt(quantityInput.value || String(min), 10);
      var next = (isNaN(current) ? min : current) + 1;
      quantityInput.value = String(next);
      quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  if (quantityDecrease && quantityInput) {
    quantityDecrease.addEventListener('click', function () {
      var min = parseInt(quantityInput.getAttribute('min') || '1', 10);
      var current = parseInt(quantityInput.value || String(min), 10);
      var next = Math.max(min, (isNaN(current) ? min : current) - 1);
      quantityInput.value = String(next);
      quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  syncVariantState();
}

function initProductSections(scope) {
  var root = scope instanceof Element ? scope : document;
  var sections = root.matches && root.matches('[data-product-section]') ? [root] : root.querySelectorAll('[data-product-section]');
  sections.forEach(function (sectionRoot) {
    initProductSection(sectionRoot);
  });
}

function initProductDetailAccordions(scope) {
  var root = scope instanceof Element ? scope : document;
  var accordions = root.querySelectorAll('[data-product-detail-accordion]');

  accordions.forEach(function (accordion) {
    if (accordion.getAttribute('data-accordion-init') === 'true') {
      return;
    }
    accordion.setAttribute('data-accordion-init', 'true');

    var summary = accordion.querySelector('[data-product-detail-summary]');
    if (!summary) {
      return;
    }

    function syncExpandedState() {
      summary.setAttribute('aria-expanded', accordion.open ? 'true' : 'false');
    }

    accordion.addEventListener('toggle', syncExpandedState);
    syncExpandedState();
  });
}

function initFeaturedDescriptions(scope) {
  var root = scope instanceof Element ? scope : document;
  var descriptions = root.querySelectorAll('[data-featured-description]');

  descriptions.forEach(function (description) {
    if (description.getAttribute('data-featured-description-init') === 'true') {
      return;
    }
    description.setAttribute('data-featured-description-init', 'true');

    var content = description.querySelector('[data-featured-description-content]');
    var toggle = description.querySelector('[data-featured-description-toggle]');
    if (!content || !toggle) {
      return;
    }

    function setExpanded(isExpanded) {
      description.classList.toggle('product-featured-description--expanded', isExpanded);
      toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      toggle.textContent = isExpanded ? 'Show less' : 'Read more';
    }

    setExpanded(false);

    window.requestAnimationFrame(function () {
      if (content.scrollHeight <= content.clientHeight + 1) {
        toggle.hidden = true;
      }
    });

    toggle.addEventListener('click', function () {
      var isExpanded = description.classList.contains('product-featured-description--expanded');
      setExpanded(!isExpanded);
    });
  });
}

initRevealAnimations();
initProductSections();
initProductDetailAccordions();
initFeaturedDescriptions();

document.addEventListener('shopify:section:load', function (event) {
  if (!event || !event.target) {
    return;
  }
  initRevealAnimations(event.target);
  initProductSections(event.target);
  initProductDetailAccordions(event.target);
  initFeaturedDescriptions(event.target);
});

document.addEventListener('click', function (event) {
  var target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (target.matches('[data-scroll-top]')) {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }
});
