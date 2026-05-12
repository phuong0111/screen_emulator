document.addEventListener('DOMContentLoaded', () => {
    // State
    let currentView = 'multi'; // 'multi', 'resizable', 'custom'
    let targetUrl = '';
    
    // Elements
    const dirInput = document.getElementById('dirInput');
    const browseBtn = document.getElementById('browseBtn');
    const watchBtn = document.getElementById('watchBtn');
    const urlInput = document.getElementById('urlInput');
    const updateBtn = document.getElementById('updateBtn');
    
    // Advanced Options Elements
    const toggleAdvancedBtn = document.getElementById('toggleAdvancedBtn');
    const advancedOptions = document.getElementById('advancedOptions');
    const requestMethod = document.getElementById('requestMethod');
    const requestHeaders = document.getElementById('requestHeaders');
    const requestBody = document.getElementById('requestBody');
    
    const viewBtns = {
        multi: document.getElementById('multiViewBtn'),
        resizable: document.getElementById('resizableViewBtn'),
        custom: document.getElementById('customViewBtn')
    };
    
    const views = {
        multi: document.getElementById('multiView'),
        resizable: document.getElementById('resizableView'),
        custom: document.getElementById('customView')
    };
    
    const frames = [
        document.getElementById('frameMobile'),
        document.getElementById('frameTablet'),
        document.getElementById('frameDesktop'),
        document.getElementById('frameResizable'),
        document.getElementById('frameCustom')
    ];
    
    const customWidthInput = document.getElementById('customWidth');
    const customHeightInput = document.getElementById('customHeight');
    const applyCustomBtn = document.getElementById('applyCustomBtn');
    const customFrameContainer = document.getElementById('customFrameContainer');
    const toast = document.getElementById('toast');

    // Socket.io for hot reloading
    const socket = io();

    socket.on('reload', () => {
        showToast('File change detected! Reloading...');
        refreshFrames();
    });

    // Event Listeners
    watchBtn.addEventListener('click', handleWatch);
    dirInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleWatch();
    });

    updateBtn.addEventListener('click', handleUpdate);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUpdate();
    });

    toggleAdvancedBtn.addEventListener('click', () => {
        const isVisible = advancedOptions.classList.toggle('show');
        toggleAdvancedBtn.classList.toggle('active', isVisible);
    });

    Object.keys(viewBtns).forEach(view => {
        viewBtns[view].addEventListener('click', () => setView(view));
    });

    applyCustomBtn.addEventListener('click', applyCustomSize);

    // Functions
    function setView(view) {
        currentView = view;
        Object.keys(viewBtns).forEach(k => viewBtns[k].classList.toggle('active', k === view));
        Object.keys(views).forEach(k => views[k].classList.toggle('active', k === view));
    }


    async function handleWatch() {
        const directory = dirInput.value.trim();
        if (!directory) return;

        try {
            const response = await fetch('/api/serve-directory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ directory })
            });
            
            const data = await response.json();
            if (data.url) {
                // Automatically set the URL input to the served directory URL
                urlInput.value = data.url;
                targetUrl = data.url;
                updateFrames(targetUrl);
                showToast('Now watching: ' + directory);
            } else if (data.error) {
                alert('Error: ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to connect to backend server.');
        }
    }

    function handleUpdate() {
        let value = urlInput.value.trim();
        if (!value) return;

        if (!value.startsWith('http')) value = 'http://' + value;
        targetUrl = value;
        updateFrames(targetUrl);
    }

    async function updateFrames(url) {
        const method = requestMethod.value;
        const headersStr = requestHeaders.value.trim();
        const bodyStr = requestBody.value.trim();

        const hasAdvanced = headersStr || bodyStr || method !== 'GET';

        if (!hasAdvanced) {
            frames.forEach(frame => {
                frame.removeAttribute('srcdoc');
                frame.src = url;
            });
            return;
        }

        // Use Proxy for advanced requests
        try {
            let headers = {};
            if (headersStr) headers = JSON.parse(headersStr);
            
            let body = null;
            if (bodyStr) body = JSON.parse(bodyStr);

            const response = await fetch('/api/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, method, headers, body })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Proxy request failed');
            }

            const html = await response.text();
            frames.forEach(frame => {
                frame.srcdoc = html;
            });
        } catch (err) {
            console.error('Proxy Error:', err);
            showToast('Error: ' + err.message);
        }
    }

    function refreshFrames() {
        if (!targetUrl) return;

        let urlWithTimestamp = targetUrl;
        try {
            const urlObj = new URL(targetUrl);
            urlObj.searchParams.set('t', Date.now());
            urlWithTimestamp = urlObj.toString();
        } catch (e) {}

        updateFrames(urlWithTimestamp);
    }

    function applyCustomSize() {
        const w = customWidthInput.value;
        const h = customHeightInput.value;
        customFrameContainer.style.width = w + 'px';
        customFrameContainer.querySelector('.frame-wrap').style.height = h + 'px';
    }

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
});