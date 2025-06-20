/**
 * Icon Morphing Animation
 * This script handles the morphing animation between pause and play icons
 * with a shrink and grow effect during transition
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the pause button
    const pauseButton = document.getElementById('pauseButton');
    if (!pauseButton) return;

    // Get the path element for morphing
    const path = pauseButton.querySelector('.pause-path');
    if (!path) return;
    
    // Add CSS for the scaling animation
    const style = document.createElement('style');
    style.textContent = `
        #pauseButton svg {
            transition: transform 0.3s ease-in-out;
        }
        #pauseButton.animating svg {
            transform: scale(0.5);
        }
    `;
    document.head.appendChild(style);

    // Function to toggle between pause and play state
    const togglePausePlay = (isPaused) => {
        const svg = pauseButton.querySelector('svg');
        
        // Start animation - shrink
        pauseButton.classList.add('animating');
        
        // Wait for shrink animation to complete before changing the path
        setTimeout(() => {
            if (isPaused) {
                // Change to play icon
                path.setAttribute('d', 'M6,5 L10,5 L10,19 L6,19 L6,5 M14,5 L18,5 L18,19 L14,19 L14,5');
                pauseButton.classList.remove('paused');
            } else {
                // Change to pause icon
                path.setAttribute('d', 'M6,5 L18,12 L6,19 L6,5');
                pauseButton.classList.add('paused');
            }
            
            // End animation - grow back to normal
            setTimeout(() => {
                pauseButton.classList.remove('animating');
            }, 10);
        }, 150); // Half of the transition duration
    };

    // Handle click event
    pauseButton.addEventListener('click', () => {
        const isPaused = pauseButton.classList.contains('paused');
        togglePausePlay(isPaused);
    });

    // Expose the toggle function for external use
    window.togglePausePlayIcon = togglePausePlay;
});