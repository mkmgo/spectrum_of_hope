(function () {
  function showVideoPlayOverlay(container, video) {
    try {
      if (!container || !video) return;
      if (container.querySelector(".video-overlay")) return;

      var overlay = document.createElement("div");
      overlay.className = "video-overlay";
      overlay.setAttribute("role", "region");
      overlay.setAttribute("aria-label", "Video playback control");

      var btn = document.createElement("button");
      btn.className = "video-play-btn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Play video");
      btn.innerHTML = "▶";

      overlay.appendChild(btn);

      // ensure container is positioned for absolute overlay
      var computed = window.getComputedStyle(container);
      if (computed.position === "static" || !computed.position) {
        container.style.position = "relative";
      }

      container.appendChild(overlay);

      function cleanUp() {
        try {
          overlay.remove();
        } catch (e) {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }
      }

      function tryPlay() {
        // ensure muted to maximize autoplay chances
        try {
          video.muted = true;
        } catch (e) {}
        var p = video.play();
        if (p && typeof p.then === "function") {
          p.then(function () {
            cleanUp();
          }).catch(function () {
            /* keep overlay */
          });
        } else {
          // If play() is not a promise, just remove overlay and hope for the best
          cleanUp();
        }
      }

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        tryPlay();
      });
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) tryPlay();
      });
      overlay.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          tryPlay();
        }
      });

      // Make the overlay itself focusable for keyboard users
      overlay.tabIndex = 0;
      // Focus button for immediate activation
      btn.focus();
    } catch (err) {
      console.error("showVideoPlayOverlay error", err);
    }
  }

  // expose globally
  window.showVideoPlayOverlay = showVideoPlayOverlay;
  
  /**
   * Try to replace a blocked video with an animated image fallback (WebP, then GIF).
   * Returns a Promise resolving to true if replaced, false otherwise.
   */
  function attemptAnimatedImageFallback(container, video, mediaUrl, caption) {
    return new Promise((resolve) => {
      if (!container || !video || !mediaUrl) return resolve(false);

      // Candidate animated image URLs (try WebP first, then GIF)
      const candidates = [
        mediaUrl.replace(/\.webm$/i, '.webp'),
        mediaUrl.replace(/\.webm$/i, '.gif'),
      ];

      let tried = 0;

      function tryNext() {
        if (tried >= candidates.length) return resolve(false);
        const url = candidates[tried++];
        const img = new Image();
        img.onload = function () {
          try {
            // Remove video element and insert animated image
            if (video && video.parentNode) video.parentNode.removeChild(video);
            img.alt = caption || '';
            img.className = 'animated-fallback';
            img.style.width = '100%';
            img.style.height = 'auto';
            img.loading = 'eager';
            // Insert into container (prefer before figcaption if present)
            const figcap = container.querySelector('figcaption');
            if (figcap) container.insertBefore(img, figcap);
            else container.appendChild(img);
            resolve(true);
          } catch (e) {
            resolve(false);
          }
        };
        img.onerror = function () {
          // try next candidate
          tryNext();
        };
        // Kick off load
        img.src = url;
      }

      tryNext();
    });
  }

  window.attemptAnimatedImageFallback = attemptAnimatedImageFallback;
})();
