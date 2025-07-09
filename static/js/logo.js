document.addEventListener('DOMContentLoaded', function() {
    var logoToggle = document.getElementById('logoToggle');
    var logoUpload = document.getElementById('logoUpload');
    var pageLogo = document.getElementById('pageLogo');
    var logoUploadButton = document.querySelector('.logo-upload .upload-button');
    var savedLogoData = localStorage.getItem('pageLogo');
    var savedLogoEnabled = localStorage.getItem('logoEnabled') === 'true';

    // Initialize logo state
    logoToggle.checked = savedLogoEnabled;
    logoUploadButton.style.display = savedLogoEnabled ? 'block' : 'none';
    
    if (savedLogoData && savedLogoEnabled) {
        pageLogo.style.display = 'block';
        pageLogo.innerHTML = '<img src="' + savedLogoData + '" alt="Page Logo"><div class="resize-handle"></div>';

        // Apply saved width if available
        var savedWidth = localStorage.getItem('logoWidth');
        if (savedWidth) {
            pageLogo.style.width = savedWidth + 'px';
        }
    }

    // Handle logo toggle
    logoToggle.addEventListener('change', function() {
        logoUploadButton.style.display = this.checked ? 'block' : 'none';
        localStorage.setItem('logoEnabled', this.checked);
        
        if (this.checked && localStorage.getItem('pageLogo')) {
            pageLogo.style.display = 'block';
            pageLogo.innerHTML = '<img src="' + localStorage.getItem('pageLogo') + '" alt="Page Logo"><div class="resize-handle"></div>';

            // Apply saved width if available
            var savedWidth = localStorage.getItem('logoWidth');
            if (savedWidth) {
                pageLogo.style.width = savedWidth + 'px';
            }
        }
        
        if (!this.checked) {
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
                logoToggle.checked = true;
                localStorage.setItem('logoEnabled', true);

                // Apply saved width if available
                var savedWidth = localStorage.getItem('logoWidth');
                if (savedWidth) {
                    pageLogo.style.width = savedWidth + 'px';
                }
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
                logoToggle.checked = true;
                localStorage.setItem('logoEnabled', true);

                // Apply saved width if available
                var savedWidth = localStorage.getItem('logoWidth');
                if (savedWidth) {
                    pageLogo.style.width = savedWidth + 'px';
                }
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