/**
 * Icon Morphing Animation
 * This script handles the morphing animation between pause and play icons
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the pause button
    const pauseButton = document.getElementById('pauseButton');
    if (!pauseButton) return;

    // Get the path element for morphing
    const path = pauseButton.querySelector('.pause-path');
    if (!path) return;

    // Function to toggle between pause and play state
    const togglePausePlay = (isPaused) => {
        if (isPaused) {
            // Animate to play icon
            path.setAttribute('d', 'M6,5 L10,5 L10,19 L6,19 L6,5 M14,5 L18,5 L18,19 L14,19 L14,5');
            pauseButton.classList.remove('paused');
        } else {
            // Animate to pause icon
            path.setAttribute('d', 'M6,5 L18,12 L6,19 L6,5');
            pauseButton.classList.add('paused');
        }
    };

    // Handle click event
    pauseButton.addEventListener('click', () => {
        const isPaused = pauseButton.classList.contains('paused');
        togglePausePlay(isPaused);
    });

    // Expose the toggle function for external use
    window.togglePausePlayIcon = togglePausePlay;
});