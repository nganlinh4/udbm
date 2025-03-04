document.addEventListener('DOMContentLoaded', function() {
    var logoToggle = document.getElementById('logoToggle');
    var logoUpload = document.getElementById('logoUpload');
    var pageLogo = document.getElementById('pageLogo');
    var logoUploadButton = document.querySelector('.logo-upload');
    var savedLogoData = localStorage.getItem('pageLogo');
    var savedLogoEnabled = localStorage.getItem('logoEnabled') === 'true';

    // Initialize logo state
    logoToggle.checked = savedLogoEnabled;
    logoUploadButton.style.display = savedLogoEnabled ? 'block' : 'none';
    
    if (savedLogoData && savedLogoEnabled) {
        pageLogo.style.display = 'block';
        pageLogo.innerHTML = '<img src="' + savedLogoData + '" alt="Page Logo"><div class="resize-handle"></div>';
    }

    // Handle logo toggle
    logoToggle.addEventListener('change', function() {
        logoUploadButton.style.display = this.checked ? 'block' : 'none';
        localStorage.setItem('logoEnabled', this.checked);
        
        if (this.checked && localStorage.getItem('pageLogo')) {
            pageLogo.style.display = 'block';
            pageLogo.innerHTML = '<img src="' + localStorage.getItem('pageLogo') + '" alt="Page Logo"><div class="resize-handle"></div>';
        }
        
        if (!this.checked) {
            pageLogo.innerHTML = '<div class="resize-handle"></div>';
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
        
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        e.preventDefault();
    }

    function handleResize(e) {
        if (!isResizing) return;
        
        var width = originalWidth + (e.clientX - originalX);
        if (width >= 50 && width <= 200) {
            pageLogo.style.width = width + 'px';
            localStorage.setItem('logoWidth', width);
        }
    }

    function stopResize() {
        isResizing = false;
        pageLogo.classList.remove('resizing');
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
    }

    // Add resize handle event listener
    pageLogo.addEventListener('mousedown', function(e) {
        var handle = pageLogo.querySelector('.resize-handle');
        if (e.target === handle) {
            initResize(e);
        }
    });

    // Initialize logo width from localStorage
    var savedWidth = localStorage.getItem('logoWidth');
    if (savedWidth) {
        pageLogo.style.width = savedWidth + 'px';
    }
});