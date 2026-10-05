/**
 * College Attendance Management System - Toast Notification Utility
 * Provides minimalist, high-contrast, animated micro-interaction feedback
 */

const toast = (function () {
    let container = document.getElementById('toast-container');

    function ensureContainer() {
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
    }

    function createToast(type, message, title = '') {
        ensureContainer();

        const toastEl = document.createElement('div');
        toastEl.className = 'toast-item flex items-start gap-3 p-4 rounded-xl border bg-white shadow-lg transition-all duration-200';

        let iconSvg = '';
        let borderColor = 'border-slate-200';
        let defaultTitle = 'Notification';

        if (type === 'success') {
            defaultTitle = title || 'Success';
            borderColor = 'border-emerald-200 bg-emerald-50/40';
            iconSvg = `
                <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
            `;
        } else if (type === 'error') {
            defaultTitle = title || 'Error';
            borderColor = 'border-rose-200 bg-rose-50/40';
            iconSvg = `
                <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </div>
            `;
        } else if (type === 'warning') {
            defaultTitle = title || 'Warning';
            borderColor = 'border-amber-200 bg-amber-50/40';
            iconSvg = `
                <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
            `;
        } else {
            defaultTitle = title || 'Info';
            borderColor = 'border-indigo-200 bg-indigo-50/40';
            iconSvg = `
                <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
            `;
        }

        toastEl.className += ` ${borderColor}`;
        toastEl.innerHTML = `
            ${iconSvg}
            <div class="flex-1 min-w-0 pt-0.5">
                <p class="text-xs font-bold uppercase tracking-wider text-slate-700">${defaultTitle}</p>
                <p class="text-sm font-medium text-slate-800 leading-snug mt-0.5">${message}</p>
            </div>
            <button class="flex-shrink-0 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors" onclick="this.closest('.toast-item').remove()">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        `;

        container.appendChild(toastEl);

        const timer = setTimeout(() => {
            removeToast(toastEl);
        }, 4000);

        toastEl.addEventListener('mouseenter', () => clearTimeout(timer));
        toastEl.addEventListener('mouseleave', () => {
            setTimeout(() => removeToast(toastEl), 2000);
        });
    }

    function removeToast(el) {
        if (!el || !el.parentNode) return;
        el.classList.add('removing');
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 200);
    }

    return {
        success: (msg, title) => createToast('success', msg, title),
        error: (msg, title) => createToast('error', msg, title),
        warning: (msg, title) => createToast('warning', msg, title),
        info: (msg, title) => createToast('info', msg, title)
    };
})();

window.toast = toast;
