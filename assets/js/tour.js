/*! Conversor Contratual para Esqueleto Solidity — © 2025-2026 Eduardo Chacon (github.com/EduChacon). Todos os direitos reservados. Uso sujeito a LICENSE. */
/*
 * Passo a passo guiado: destaca um elemento da página por vez e mostra, num
 * cartão fixo, o que fazer. Cada passo pode preparar a tela (abrir painel,
 * gerar código etc.) antes de ser exibido.
 */
(function () {
    'use strict';
    const CSC = (window.CSC = window.CSC || {});
    const t = (k, v) => CSC.t(k, v);

    let steps = [];
    let index = 0;
    let card = null;
    let current = null;

    function clear() {
        if (current) current.classList.remove('tour-target');
        current = null;
    }

    function ensureCard() {
        if (card) return card;
        card = document.createElement('div');
        card.className = 'tour-card';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-live', 'polite');
        document.body.appendChild(card);
        document.addEventListener('keydown', e => { if (card && !card.hidden && e.key === 'Escape') stop(); });
        return card;
    }

    async function show(i) {
        index = Math.max(0, Math.min(i, steps.length - 1));
        const step = steps[index];
        clear();
        const c = ensureCard();
        c.hidden = false;
        c.textContent = '';
        const wait = document.createElement('p');
        wait.className = 'tour-text';
        wait.textContent = t('tourPreparing');
        c.appendChild(wait);
        try { if (step.before) await step.before(); } catch (_) { /* segue mesmo assim */ }
        const target = typeof step.target === 'function' ? step.target() : document.querySelector(step.target);
        if (target) {
            current = target;
            target.classList.add('tour-target');
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        c.textContent = '';
        const head = document.createElement('p');
        head.className = 'tour-count';
        head.textContent = t('tourStep', { i: index + 1, n: steps.length });
        const title = document.createElement('p');
        title.className = 'tour-title';
        title.textContent = step.title;
        const text = document.createElement('p');
        text.className = 'tour-text';
        text.textContent = step.text;
        const nav = document.createElement('div');
        nav.className = 'tour-nav';
        const mk = (label, fn, cls, disabled) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = cls;
            b.textContent = label;
            b.disabled = !!disabled;
            b.addEventListener('click', fn);
            return b;
        };
        nav.append(
            mk(t('tourExit'), stop, 'link-btn'),
            mk(t('tourPrev'), () => show(index - 1), 'btn btn-quiet', index === 0),
            index === steps.length - 1 ? mk(t('tourDone'), stop, 'btn btn-ink') : mk(t('tourNext'), () => show(index + 1), 'btn btn-ink')
        );
        c.append(head, title, text, nav);
        nav.querySelector('.btn-ink').focus({ preventScroll: true });
    }

    function stop() {
        clear();
        if (card) card.hidden = true;
        steps = [];
    }

    CSC.tour = {
        start(list) { steps = list; show(0); },
        stop,
        active: () => !!(card && !card.hidden)
    };
})();
