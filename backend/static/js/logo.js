document.addEventListener('DOMContentLoaded', function() {
    var logoToggle = document.getElementById('logoToggle');
    var logoUpload = document.getElementById('logoUpload');
    var pageLogo = document.getElementById('pageLogo');
    var logoUploadButton = document.querySelector('.logo-upload .upload-button');
    var savedLogoData = localStorage.getItem('pageLogo');
    var savedLogoEnabled = localStorage.getItem('logoEnabled') === 'true';

    var DEFAULT_LOGO_WIDTH = 300;

    function applyLogoWidth() {
        var savedWidth = parseInt(localStorage.getItem('logoWidth'), 10);
        if (savedWidth && savedWidth >= 50 && savedWidth <= 1000) {
            pageLogo.style.width = savedWidth + 'px';
        } else {
            pageLogo.style.width = DEFAULT_LOGO_WIDTH + 'px';
        }
    }

    // Initialize logo state
    logoToggle.selected = savedLogoEnabled;
    logoUploadButton.style.display = savedLogoEnabled ? 'block' : 'none';

    if (savedLogoData && savedLogoEnabled) {
        pageLogo.style.display = 'block';
        pageLogo.innerHTML = '<img src="' + savedLogoData + '" alt="Page Logo"><div class="resize-handle"></div>';

        applyLogoWidth();
    }

    // Handle logo toggle
    logoToggle.addEventListener('change', function() {
        logoUploadButton.style.display = this.selected ? 'block' : 'none';
        localStorage.setItem('logoEnabled', this.selected);

        if (this.selected && localStorage.getItem('pageLogo')) {
            pageLogo.style.display = 'block';
            pageLogo.innerHTML = '<img src="' + localStorage.getItem('pageLogo') + '" alt="Page Logo"><div class="resize-handle"></div>';

            applyLogoWidth();
        }

        if (!this.selected) {
            pageLogo.innerHTML = '';
            pageLogo.style.display = 'none';
        }
    });

    // Handle logo upload
    logoUpload.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var logoData = e.target.result;
                pageLogo.innerHTML = '<img src="' + logoData + '" alt="Page Logo"><div class="resize-handle"></div>';
                localStorage.setItem('pageLogo', logoData);
                pageLogo.style.display = 'block';
                logoToggle.selected = true;
                localStorage.setItem('logoEnabled', true);

                applyLogoWidth();
            };
            reader.readAsDataURL(file);
        }
    });

    // Handle logo drag-and-drop
    logoUploadButton.addEventListener('dragover', (e) => {
        e.preventDefault();
        logoUploadButton.classList.add('dragover');
    });
    logoUploadButton.addEventListener('dragleave', () => {
        logoUploadButton.classList.remove('dragover');
    });
    logoUploadButton.addEventListener('drop', (e) => {
        e.preventDefault();
        logoUploadButton.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const logoData = e.target.result;
                pageLogo.innerHTML = '<img src="' + logoData + '" alt="Page Logo"><div class="resize-handle"></div>';
                localStorage.setItem('pageLogo', logoData);
                pageLogo.style.display = 'block';
                logoToggle.selected = true;
                localStorage.setItem('logoEnabled', true);

                applyLogoWidth();
            };
            reader.readAsDataURL(file);
        }
    });

    // Handle logo resize
    var isResizing = false;
    var originalWidth;
    var originalX;

    function initResize(e) {
        isResizing = true;
        originalWidth = pageLogo.offsetWidth;
        originalX = e.clientX;
        pageLogo.classList.add('resizing');

        // Prevent text selection during resize
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'se-resize';

        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        e.preventDefault();
        e.stopPropagation();
    }

    function handleResize(e) {
        if (!isResizing) return;

        var width = originalWidth + (e.clientX - originalX);
        if (width >= 50 && width <= 1000) {
            pageLogo.style.width = width + 'px';
            localStorage.setItem('logoWidth', width);
        }
    }

    function stopResize() {
        isResizing = false;
        pageLogo.classList.remove('resizing');

        // Restore normal cursor and text selection
        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
    }

    // Add resize handle event listener using event delegation
    document.addEventListener('mousedown', function(e) {
        if (e.target.classList.contains('resize-handle') && e.target.closest('#pageLogo')) {
            console.log('Resize handle clicked'); // Debug log
            initResize(e);
        }
    });

    // Add visual feedback for resize handle
    document.addEventListener('mouseover', function(e) {
        if (e.target.classList.contains('resize-handle') && e.target.closest('#pageLogo')) {
            e.target.style.opacity = '1';
            e.target.style.transform = 'scale(1.2)';
        }
    });

    document.addEventListener('mouseout', function(e) {
        if (e.target.classList.contains('resize-handle') && e.target.closest('#pageLogo')) {
            if (!isResizing) {
                e.target.style.opacity = '';
                e.target.style.transform = '';
            }
        }
    });


});