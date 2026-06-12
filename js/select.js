const ENHANCED_CLASS = 'native-select-enhanced';

function getSelectedLabel(select) {
    return select.options[select.selectedIndex]?.textContent || '';
}

function closeAllSelectMenus(except = null) {
    document.querySelectorAll('.select-shell.open').forEach((shell) => {
        if (shell !== except) shell.classList.remove('open');
    });
}

function syncShell(select, shell) {
    const value = shell.querySelector('.select-value');
    const menu = shell.querySelector('.select-menu');
    if (!value || !menu) return;

    value.textContent = getSelectedLabel(select);
    menu.innerHTML = '';
    [...select.options].forEach((option) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'select-option';
        item.textContent = option.textContent;
        item.dataset.value = option.value;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', option.selected ? 'true' : 'false');
        item.addEventListener('click', () => {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            closeAllSelectMenus();
        });
        menu.appendChild(item);
    });
}

function enhanceSelect(select) {
    if (!select || select.classList.contains(ENHANCED_CLASS)) return;

    const shell = document.createElement('div');
    shell.className = 'select-shell';
    shell.dataset.selectId = select.id || '';
    shell.innerHTML = `
        <button class="select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
            <span class="select-value"></span>
            <svg class="select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path d="M7 10l5 5 5-5"/>
            </svg>
        </button>
        <div class="select-menu" role="listbox"></div>
    `;

    select.classList.add(ENHANCED_CLASS);
    select.insertAdjacentElement('afterend', shell);
    syncShell(select, shell);

    const trigger = shell.querySelector('.select-trigger');
    trigger.addEventListener('click', () => {
        const nextOpen = !shell.classList.contains('open');
        closeAllSelectMenus(shell);
        shell.classList.toggle('open', nextOpen);
        trigger.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    });

    trigger.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeAllSelectMenus();
    });

    select.addEventListener('change', () => syncShell(select, shell));
}

export function refreshEnhancedSelects() {
    document.querySelectorAll('select').forEach((select) => {
        if (select.classList.contains(ENHANCED_CLASS)) {
            const shell = select.nextElementSibling?.classList.contains('select-shell') ? select.nextElementSibling : null;
            if (shell) syncShell(select, shell);
        } else {
            enhanceSelect(select);
        }
    });
}

export function initEnhancedSelects() {
    refreshEnhancedSelects();
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.select-shell')) closeAllSelectMenus();
    });
}
